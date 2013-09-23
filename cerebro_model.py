# The MIT License (MIT)
#
# Copyright (c) 2013 Numenta, Inc.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.

import nupic.frameworks.opf.opfhelpers as opfhelpers
import tempfile
import os.path
import json
import pymongo
import re
import pprint

from collections import deque
from anomaly_runner import AnomalyRunner
from experiment_runner import ExperimentRunner
from Dataset import (FileDataset,
                     ProceduralDataset,
                     SamplingDict)
from Queue import Queue
from nupic.frameworks.opf.exp_generator.ExpGenerator import (expGenerator)
from nupic.frameworks.opf.opfutils import (InferenceType,
                                           InferenceElement)

from experiment_db import ExperimentDB

class CerebroModel:

  # Dummy Streamdef used for procedural datasets
  _DUMMY_STREAMDEF = dict(
    version = 1,
    info = "cerebro_dummy",
    streams = [
      dict(source="file://joined_mosman_2011.csv",
           info="hotGym.csv",
           columns=["*"],
           ),
      ],
    )

  _ptr = None

  @staticmethod
  def get():
    if not CerebroModel._ptr:
      CerebroModel._ptr = CerebroModel()
    return CerebroModel._ptr


  def __init__(self):
    # All the Dataset objects for this session
    self.datasets = []
    self.models = []
    self.currentDataset  = None
    self.currentModel = None
    self.experimentRunner = None
    self.descriptionText = ""
    self.subDescriptionText = ""
    self.control = None

    # Name of model - used for mongodb name
    self.default_name = "_lastModelRun"
    self.name = self.default_name

    # Data for current model
    self.__currentModelData = []

    # MongDB stuff
    self.dbConnection = pymongo.Connection()
    self.db = self.dbConnection["CerebroDB"]
    self.db.drop_collection("modelOutput")
    self.collection = self.db.modelOutput



  def loadDescriptionFile(self, descriptionFile, subDescriptionFile=None):
    """
    Loads a description.py and creates a new experiment

    Parameters:
    -----------------------------------------------------------------------
    descriptionFile:        A filename or open file object corresponding to
                            the description.py

    subDescriptionFile:     A file corresponding to a sub description file
    """

    # TODO: Hack for now is to write open experiment file to a temp directory
    #if type(descriptionFile) is not str:
    tempDir = tempfile.mkdtemp()
    expPath = os.path.join(tempDir, "description.py")
    with open(expPath, "w") as tempDescription:
      tempDescription.write(descriptionFile)

    self.descriptionText = descriptionFile
    self.subDescriptionText = subDescriptionFile
    descriptionFile = expPath

    if subDescriptionFile:
      # Make sure that there is relative path to the base
      pattern = r'(.+importBaseDescription)\((.+),(.*)\)'
      repl = r"\g<1>('../description.py', \g<3>)"
      subDescriptionFile = re.sub(pattern, repl, subDescriptionFile)

      os.makedirs(os.path.join(tempDir, "model_0"))
      expPath = os.path.join(tempDir, "model_0", "description.py")
      with open(expPath, "w") as f:
        f.write(subDescriptionFile)
      descriptionFile = expPath

    # -----------------------------------------------------------------------
    # Get the model parameters
    #
    experimentDir = os.path.dirname(descriptionFile)
    expIface = self.__getCurrentModelFromDir(experimentDir)

    # -----------------------------------------------------------------------
    # Get the data path and create the Dataset object
    #
    control = expIface.getModelControl()
    self.control = control
    if control['environment'] == 'opfExperiment':
      experimentTasks = expIface.getModelControl()['tasks']
      task = experimentTasks[0]
      datasetURI = task['dataset']['streams'][0]['source']

    elif control['environment'] == 'grok':
      datasetURI = control['dataset']['streams'][0]['source']

    datasetPath = datasetURI[len("file://"):]
    dataset = FileDataset(control['dataset'])
    self.datasets.append(dataset)
    self.currentDataset = len(self.datasets) - 1
    self.experimentRunner = None
    return True




  def createProceduralDataset(self, fnText, iterations):
    """ Create a dataset from the text of a function"""


    fnLines = fnText.split('\n')

    filteredText = ['def foo(t):',
                    '\tfields=SamplingDict()'
                    ]

    # Filter out lines with return statements
    for line in fnLines:
      if line.find('return') >= 0:
        continue
      filteredText.append('\t'+line)

    filteredText.append('\treturn fields')

    fnText = '\n'.join(filteredText)
    code = compile(fnText, "<string>", "exec")


    # -----------------------------------------------------------------------
    # Import global modules available to the function
    import random
    import numpy
    import string
    import math
    history = deque([], 20)

    globs={'random': random,
           'numpy':numpy,
           'string':string,
           "math": math,
           'SamplingDict':SamplingDict,
           'history':history
           }
    locs = {}
    eval(code, globs, locs)


    foo = locs['foo']

    dataset = ProceduralDataset(foo, iterations, history)
    self.datasets.append(dataset)
    self.currentDataset = len(self.datasets) - 1

    datasetInfo = self.datasets[self.currentDataset].getDatasetFieldMetaData()
    includedFields = []
    for fieldInfo in datasetInfo:
      includedFields.append({'fieldName': fieldInfo.name,
                             'fieldType':fieldInfo.type})


    expDesc = json.dumps(dict( environment = "grok",
                    inferenceType=InferenceType.TemporalMultiStep,
                    inferenceArgs={"predictedField":datasetInfo[0].name,
                                    "predictionSteps":[1]},
                    includedFields=includedFields,
                    streamDef=self._DUMMY_STREAMDEF,
                   ))

    tempDir = tempfile.mkdtemp()
    expGenerator(["--description=%s"%expDesc, "--outDir=%s"%tempDir, "--version=v2"])

    descFile = os.path.join(tempDir, "description.py")

    f = open(descFile)
    self.descriptionText = f.read()
    f.close()

    self.__getCurrentModelFromDir(tempDir)
    return True




  def __getCurrentModelFromDir(self, expDir):
    """ Loads a description.py file from the specified directory, and sets it to
    be the current model """
    descriptionPyModule = \
                      opfhelpers.loadExperimentDescriptionScriptFromDir(expDir)
    expIface = \
      opfhelpers.getExperimentDescriptionInterfaceFromModule(descriptionPyModule)
    modelDescription = expIface.getModelDescription()
    modelDescription['predictedField'] = None
    modelDescription['modelParams']['clParams']['implementation'] = 'py'

    # Add model to global list
    self.models.append(modelDescription)
    self.currentModel = len(self.models) - 1
    self.control = expIface.getModelControl()

    modelDescription['predictedField'] = self.control['inferenceArgs']['predictedField']

    return expIface



  def getDescriptionText(self):
    """ Return the text for a BASE description file """
    return self.descriptionText



  def getDatasetText(self):
    """ Returns the text of the dataset, in csv format """
    dataset = self.datasets[self.currentDataset]
    metaData = dataset.getDatasetFieldMetaData()
    names = [f.name for f in metaData]
    types = [f.type for f in metaData]
    specials = [f.special for f in metaData]

    lines = [", ".join(names), ", ".join(types), ", ".join(specials)]

    while True:
      try:
        record = dataset.getNextRecord()
        values = [str(record[name]) for name in names]
        lines.append(", ".join(values))
      except StopIteration:
        break

    return "\n".join(lines)



  def getCurrentModelParams(self):
    """Gets the parameters for the current models

      Returns:
    """
    return self.models[self.currentModel]



  def setPredictedField(self, fieldname):
    "Sets the predicted field for the CURRENT model."

    # TODO: validate fieldname
    currentModel = self.models[self.currentModel]
    currentModel['predictedField'] = fieldname
    if self.control['inferenceArgs'] is None:
       self.control['inferenceArgs'] = {}
    self.control['inferenceArgs']['predictedField'] = fieldname
    pprint.pprint(self.models[self.currentModel])



  def setModelParams(self, newParams):
    """"
    Updates the current model params dictionary
    """
    self.models[self.currentModel]['modelParams'] = newParams


  def setClassifierThreshold(self, threshold):
    results = dict()
    if self.experimentRunner is not None:
      results['labels'] = self.experimentRunner.setClassifierThreshold(threshold)
    pprint.pprint(results)
    return results



  def getExperimentInfo(self, modelDescription):
    """Get details about the current experiment to return to the client"""
    expInfo = {"name" : self.name,
               "started" : True,
               "fieldInfo" : {}}

    fieldRanges = self.experimentRunner.getFieldRanges()
    fieldInfo = {}
    for name, fRange in fieldRanges.iteritems():
      fieldInfo[name] = {}
      fieldInfo[name]['size'] = fRange[1] - fRange[0]
    expInfo['fieldInfo'] = fieldInfo

    return expInfo


  def runCurrentExperiment(self, expType="Standard", isLoad=False):
    """
    Creates an experiment runner for the current model and starts running the
    model in a seperate thread
    """
    if self.experimentRunner:
      self.stopCurrentExperiment()
      self.datasets[self.currentDataset].rewind()

    if isLoad:
      modelInfo = json.loads(ExperimentDB.get(self.name)['metadata'])
      modelDescriptionText = modelInfo['modelDescriptionText']
      subDescriptionText = modelInfo['subDescriptionText']
      self.loadDescriptionFile(modelDescriptionText, subDescriptionText)
    else:
      data = dict(
        modelDescriptionText=self.descriptionText,
        subDescriptionText=self.subDescriptionText
      )
      ExperimentDB.add(self.name, data)

    self.__currentModelData = []
    if expType == "Standard":
      self.experimentRunner = ExperimentRunner(
                                  name = self.name,
                                  modelDescription=self.models[self.currentModel],
                                  control= self.control,
                                  dataset=self.datasets[self.currentDataset])
    elif expType == "Anomaly":
      self.experimentRunner = AnomalyRunner(
                                  name = self.name,
                                  modelDescription=self.models[self.currentModel],
                                  control= self.control,
                                  dataset=self.datasets[self.currentDataset])

    if isLoad:
      self.experimentRunner.load()
    else:
      self.experimentRunner.run()

    return self.getExperimentInfo(self.models[self.currentModel])



  def stopCurrentExperiment(self):
    """Stops the current experiment """
    self.experimentRunner.stop()



  def getLatestPredictions(self):
    """ Gets the latest set of predictions from the ExperimentRunner. Blocks
    if there are no new results
    """
    newData = []
    while True:
      if not self.experimentRunner:
        return None
      newData = self.experimentRunner.getNewData()
      if newData or self.experimentRunner.isFinished():
        break

    data = dict(
      results = dict(
        actual = [],
      ),
      finished = self.experimentRunner.isFinished()
    )

    if newData is None:
      return data

    results = data['results']
    # -----------------------------------------------------------------------
    # Figure out which inference elements are being generated
    inferenceElements = set(json.loads(newData[0]['inferences']).keys())
    if InferenceElement.prediction in inferenceElements \
    or InferenceElement.multiStepBestPredictions in inferenceElements:
      results['prediction'] = []


    if InferenceElement.anomalyScore in inferenceElements:
      results['anomaly'] = []
      results['anomalyLabel'] = []

    # -----------------------------------------------------------------------
    # Fill return dict with data
    predictedField = self.models[self.currentModel]['predictedField']
    for elem in newData:
      predictedFieldIndex = self.experimentRunner.getFieldNames().index(predictedField)
      inferences = json.loads(elem["inferences"])

      results['actual'].append(elem["actual"])

      if 'prediction' in results:
        if InferenceElement.multiStepBestPredictions in inferenceElements:
          inference = inferences[InferenceElement.multiStepBestPredictions]
          step = min(inference.iterkeys())
          prediction =inference[step]
        else:
          prediction = inferences[InferenceElement.prediction][predictedFieldIndex]
        if prediction is None:
          prediction = 0.0
        results['prediction'].append(prediction)

      if 'anomaly' in results:
        anomaly = inferences[InferenceElement.anomalyScore]
        results['anomaly'].append(anomaly)
        if InferenceElement.anomalyLabel in inferences:
          anomalyLabel = inferences[InferenceElement.anomalyLabel]
          results['anomalyLabel'].append(anomalyLabel)



    # print "Actual", len(results["actual"]), "Prediction", len(results["prediction"])
    return data



  def getDataAtTime(self, dataInput):

    """ Gets all of the model data for the current timestep.

    Returns:
            ...
    """
    output = self.experimentRunner.getDataAtTime(dataInput)
    output['auxText'] = self.experimentRunner.auxText(dataInput['timestep'], output)

    return output


  # Managing Experiments
  def setExperimentName(self, name):
    return self.experimentRunner.setName(name)

