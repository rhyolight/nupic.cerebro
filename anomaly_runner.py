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

import numpy
import itertools
import json
import cPickle as pickle
import zlib
from time import (sleep)
import threading
import multiprocessing
import copy
import datetime
import pymongo
import gevent
from pprint import pprint


from collections import namedtuple
from Queue import Empty
from multiprocessing import Queue

from nupic.bindings.math import (NearestNeighbor, min_score_per_category)

import nupic.frameworks.opf.opfutils
from nupic.frameworks.opf.opfutils import (InferenceType,
                                           InferenceElement)
import nupic.frameworks.opf.opfhelpers as opfhelpers
import nupic.frameworks.opf.opfbasicenvironment as opfbasicenv
from nupic.frameworks.opf.modelfactory import ModelFactory
from nupic.data.dictutils import DictObj

from nupic.support.configuration import Configuration

from runner import Runner

from nupic.algorithms.KNNClassifier import KNNClassifier

from experiment_db import ExperimentDB

SimulationDataElement = namedtuple('SimulationDataElement',
                                   ['record',
                                    'modelResult'])

############################################################################
class AnomalyRunner(Runner):

  def __init__(self, name, modelDescription, control, dataset, params=None):

    #modelDescription['model'] = 'AnomalyClassifier'

    super(AnomalyRunner, self).__init__(name,
                                        modelDescription,
                                        control,
                                        dataset,
                                        params=params)


  def setClassifierThreshold(self, threshold):
    threshold = float(threshold)

    model = self._model
    classifier = model._getAnomalyClassifier()
    classifier.getSelf().clear()


    experimentData = self.collection.find().sort('_id', pymongo.ASCENDING)
    results = []
    for record in experimentData:
      print int(record['_id'])
      knnVector = json.loads(record['classifierVector'])
      if knnVector is None or int(record['_id']) < 50:
        results.append(None)
        continue
      knnVector['bottomUpIn'] = numpy.array(knnVector['bottomUpIn'])
      inferences = json.loads(record['inferences'])
      
      score = float(inferences['anomalyScore'])

      inputCategory = 0
      if score >= threshold:
        inputCategory = 1
      else:
        outputs = {"categoriesOut": numpy.zeros((2,)),
                   "bestPrototypeIndices":numpy.zeros((2,)),
                   "categoryProbabilitiesOut":numpy.zeros((2,))}
        classifier.setParameter('learningMode', False)
        classifier.getSelf().compute(knnVector, outputs)
        classifier.setParameter('learningMode', True)
        if len(outputs['categoriesOut']) > 0:
          label = outputs['categoriesOut'].argmax()
          inputCategory = label   

      knnVector['categoryIn'] = [inputCategory]
      outputs = {"categoriesOut": numpy.zeros((2,)),
                 "bestPrototypeIndices":numpy.zeros((2,)),
                 "categoryProbabilitiesOut":numpy.zeros((2,))}

      classifier.getSelf().compute(knnVector, outputs)

      label = None
      if len(outputs['categoriesOut']) > 0:
        label = outputs['categoriesOut'].argmax()

      if inputCategory:
        label = 1

      if label == 0:
        label = None
      results.append(label)
    return results


  ############################################################################
  def _runExperimentLoop(self, queue):
    collection = ExperimentDB.getExperimentDB(self.name)

    while self._maxiterations == -1 or self._iteration <= self._maxiterations:
      try:
        # Get next record
        record = self._dataset.getNextRecord()
        
      except StopIteration:
        self._isFinished.set()
        return None
      
      if self._stop.isSet():
        break

      # Feed record to model and get prediction
      modelResult = self._model.run(record)
      
      if modelResult is None:
        continue

      if modelResult.inferences[InferenceElement.anomalyVector] is not None:
        modelResult.inferences[InferenceElement.anomalyVector] = \
          modelResult.inferences[InferenceElement.anomalyVector].nonzero()[0].tolist()        

      distances = self._model._classifier_distances #classifier.getSelf().getLatestDistances()
      sortedDistIdx = []
      sortedDists = []
      if distances is not None and len(distances) > 0:
        sortedDistIdx = distances.argsort()
        sortedDists = distances[sortedDistIdx[:5]].tolist()

        idList = self._model._classifier_indexes #classifier.getSelf().getParameter('categoryRecencyList')

        if len(idList) > 0:
          sortedDistIdx = [ \
              idList[i] + self._model._classificationDelay - 1\
              for i in sortedDistIdx[:min(5, len(sortedDistIdx))]]
        else:
          sortedDistIdx = []
        #matrix = classifier.getSelf()._knn._Memory
        #print matrix.shape
        #print "Index: %s" % (sorted)
        #if len(sorted) > 0:
        #  print matrix.getRow(int(sorted[0]))
        #  print matrix.getRow(int(sorted[0])).nonzero()[0]

      predictedField = self._modelDescription["predictedField"]
      predictedFieldIndex = self.getFieldNames().index(predictedField)

      modelResult.inferences['encodings'] = None
      modelResult.sensorInput.dataEncodings = None
      
      actual = modelResult.sensorInput.dataRow[predictedFieldIndex]


      dbelem = {"_id":self._iteration,
                "actual": actual,
                "inferences": json.dumps(modelResult.inferences),
                "classificationIdx":json.dumps(sortedDistIdx),
                "classificationDist":json.dumps(sortedDists)
              }
      
      collection.insert(dbelem)
      
      self._dataQ.put(dbelem)
        
      self._iteration += 1
      gevent.sleep(0)

    self._isFinished.set()


  def getDataAtTime(self, dataInput):
    inputType = dataInput.get('type','protos')

    timestep = int(dataInput['timestep'])
    if inputType == 'protos':
      return self.getProtosAtTime(timestep)
    elif inputType == 'details':
      return self.getDetailsAtTime(timestep)


  def getDetailsAtTime(self, timestep):
    collection = ExperimentDB.getExperimentDB(self.name)
    return collection.find_one({"_id":timestep})


  def getProtosAtTime(self, timestep):

    collection = ExperimentDB.getExperimentDB(self.name)

    experimentData = collection.find_one({"_id":timestep})
    
    experimentData['protos'] = []

    predictedField = self._modelDescription["predictedField"]
    predictedFieldIndex = self.getFieldNames().index(predictedField)

    dists = json.loads(experimentData['classificationDist'])

    for distId in json.loads(experimentData["classificationIdx"]):
      distSurroundingValues = collection.find({"_id": {
          "$gt": distId-10, "$lt": distId+10 
      }}).sort('_id', pymongo.ASCENDING)

      experimentData['protos'].append(dict(
        ids=[],
        actual=[],
        prediction=[],
        anomaly=[],
        anomalyLabel=[],
        dist=dists.pop(0),
        index=distId
      ))
      protosId = len(experimentData['protos']) - 1
      for distSurroundingValue in distSurroundingValues:
        inferences = json.loads(distSurroundingValue["inferences"])

        actual = distSurroundingValue["actual"]

        
        inference = inferences[InferenceElement.multiStepBestPredictions]
        step = min(inference.iterkeys())
        prediction =inference[step]
        
        if prediction is None:
          prediction = 0.0

        anomaly = inferences[InferenceElement.anomalyScore]
        anomalyLabel = inferences[InferenceElement.anomalyLabel]
        experimentData['protos'][protosId]["ids"].append(distSurroundingValue["_id"])
        experimentData['protos'][protosId]["actual"].append(actual)
        experimentData['protos'][protosId]["prediction"].append(prediction)
        experimentData['protos'][protosId]["anomaly"].append(anomaly)
        experimentData['protos'][protosId]["anomalyLabel"].append(anomalyLabel)

    return experimentData



