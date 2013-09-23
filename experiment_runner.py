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
import pprint
import gevent
import sys
import os
import cStringIO as StringIO


from collections import namedtuple
from Queue import Empty
from multiprocessing import Queue

from experiment_db import ExperimentDB



import nupic.frameworks.opf.opfutils
from nupic.frameworks.opf.opfutils import (InferenceType,
                                           InferenceElement)
import nupic.frameworks.opf.opfhelpers as opfhelpers
import nupic.frameworks.opf.opfbasicenvironment as opfbasicenv
from nupic.frameworks.opf.modelfactory import ModelFactory
from nupic.data.dictutils import DictObj

from runner import Runner



SimulationDataElement = namedtuple('SimulationDataElement',
                                   ['record',
                                    'modelResult',
                                    'sourceScalars',
                                    'sensorBUOut',
                                    'SPBUOut',
                                    'overlaps',
                                    'nConnectedInputs',
                                    'predictedCols',
                                    'predictedConfidences',
                                    'tpActive',
                                    'tpPredicted',
                                    'permanences',
                                    'sensorPredicted'])

############################################################################
class ExperimentRunner(Runner):


  def _formatActiveCells(self, activeCells):
    numCells = activeCells.sum(1)
    formattedCells = zip(numpy.where(numCells == 32)[0].tolist(),
                        itertools.repeat("burst"))
    singleCells = activeCells[numCells != 32, :].nonzero()
    formattedCells.extend(zip(*(l.tolist() for l in singleCells)))
    return formattedCells


  def _runExperimentLoop(self, queue):

    self.prevFieldPred = {}

    self._model.resetSequenceStates()

    cOut = os.fdopen(os.open("/tmp/cerebro.cout", os.O_RDWR | os.O_CREAT), 'w+')
    oldC = os.dup(1)

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

      # Feed record to model and get prediction. Capture all the stdout as well
      os.dup2(cOut.fileno(), 1)

      modelResult = self._model.run(record)

      os.dup2(oldC, 1)

      cOut.seek(0)
      verboseOutput = cOut.read()
      cOut.truncate(0)

      modelResult.inferences['encodings'] = None
      modelResult.sensorInput.dataEncodings = None

      model = self._model
      sensor = model._getSensorRegion()
      sp = model._getSPRegion()
      tp = model._getTPRegion()
      cl = model._getClassifierRegion()

      spImp = None
      tpImp = None

      if sp is not None:
        spImp = sp.getSelf()._sfdr
      if tp is not None:
        tpImp = tp.getSelf()._tfdr
      clImp = cl.getSelf()._claClassifier

      #Copy all the pertinent data
      sourceScalars = copy.deepcopy(sensor.getOutputData('sourceOut'))
      sensorBits = sensor.getOutputData('dataOut')
      sensorBUOut = sensorBits.nonzero()[0].tolist()

      SPBUOut = []
      nConnectedInputs = []
      overlaps = []

      if spImp is not None:
        SPBUOut = sp.getOutputData('bottomUpOut').nonzero()[0].tolist()
        nConnectedInputs = spImp._allConnectedM.nNonZerosPerRow()[SPBUOut].astype('int32').tolist()
        overlaps = zip(SPBUOut,
                       spImp._overlapsNoBoost[SPBUOut].astype('int32').tolist())


      TPTDOut = tp.getOutputData('topDownOut') if tp else None
      sensorTDIn = sensor.getInputData('temporalTopDownIn')

      permanences = {}
      predictedCols = ()
      predictedConfidences = ()
      tpInfActiveCells = ()
      tpLrnActiveCells = ()
      tpPredCells = []

      if TPTDOut is not None:
        predictedCols = TPTDOut.nonzero()[0].tolist()
        predictedConfidences = TPTDOut[predictedCols].tolist()
        tpInfActiveCells = self._formatActiveCells(tpImp.infActiveState['t'])
        tpLrnActiveCells = self._formatActiveCells(tpImp.lrnActiveState['t'])
        tpInfPredT_1 = self._formatActiveCells(tpImp.infPredictedState['t-1'])
        tpInfPredT = self._formatActiveCells(tpImp.infPredictedState['t'])
        tpPredCells = tpImp.infPredictedState['t'].nonzero()[0].tolist()

      sensorPredBits = []
      if sensorTDIn is not None:
        sensorPredBits = sensorTDIn

      if self.prevPredictedCols is None:
        self.prevPredictedCols = []
        self.prevTPPredictedCells = []
        self.prevPredictedConfs = []
        self.prevTPPredicted = []

      clPattern = clImp._patternNZHistory[-1]
      step = clImp.steps[0]
      bitHistories = {}

      fieldActivations = {}
      fieldPredictions = {}
      for fieldName, (start, stop) in self.fieldRanges.iteritems():
        nzBits = sensorBits[start:stop].nonzero()[0]
        fieldActivations[fieldName] = nzBits.tolist()
        nzBits = sensorPredBits[start:stop].nonzero()[0]
        fieldPredictions[fieldName] = nzBits.tolist()

      predictedField = self._modelDescription["predictedField"]
      predictedFieldIndex = self.getFieldNames().index(self.predictedField)
      actual = modelResult.sensorInput.dataRow[predictedFieldIndex]

      dthandler = lambda obj: obj.isoformat() if isinstance(obj,
                                                            datetime.datetime) \
                                              else None
      record = {"_id":self._iteration,
                "actual": actual,
                "SPBUOut":SPBUOut,
                "overlaps":overlaps,
                "predictedCols": self.prevPredictedCols,
                "tpInfActive": tpInfActiveCells,
                "tpLrnActive": tpLrnActiveCells,
                "tpPredicted": self.prevTPPredictedCells,
                "tpInfPredT_1":tpInfPredT_1,
                "tpInfPredT":tpInfPredT,
                "permanences": permanences,
                "overlaps": overlaps,
                "inferences": json.dumps(modelResult.inferences),
                "record":json.dumps(modelResult.rawInput,
                                    default=dthandler),
                "fieldActivations":fieldActivations,
                #TODO: for some reason, field predictions don't need to be shifted??
                "fieldPredictions": fieldPredictions,
                "verboseOutput": verboseOutput,
                }

      collection.insert(record)

      self._dataQ.put(record)

      self.prevPredictedCols = predictedCols
      self.prevTPPredictedCells = tpPredCells
      self.prevPredictedConfs = predictedConfidences
      #self.prevTPPredicted = tpPredCells
      self.prevTPPredicted = None
      self.prevFieldPred = fieldPredictions

      self._iteration += 1
      gevent.sleep(0)

    os.close(oldC)
    cOut.close()
    self._isFinished.set()

  def auxText(self, timestep, experimentData):
    auxText = []
    import pprint
    auxText.append("-----------------------------------------------------------")
    auxText.append( "Data at time: %s" % timestep)

    auxText.append("\nRaw Input")
    auxText.append(pprint.pformat(experimentData["record"]))

    auxText.append("\nInferences")
    auxText.append(pprint.pformat(json.loads(experimentData["inferences"])))

    #auxText.append("Sensor predicted")
    #auxText.append(pprint.pformat(experimentData.sensorPredicted))

    # auxText.append("\nOverlaps")
    # auxText.append(pprint.pformat(experimentData["overlaps"]))

    #auxText.append("\nConfidences")
    #auxText.append(pprint.pformat(zip(experimentData.predictedCols,
    #                                  experimentData.predictedConfidences)))
    #
    # auxText.append("\nInference TPCells")
    # auxText.append(pprint.pformat(experimentData["tpInfActive"]))

    # auxText.append("\ntpInfPredT_1")
    # auxText.append(pprint.pformat(experimentData["tpInfPredT_1"]))

    # auxText.append("\ntpInfPredT")
    # auxText.append(pprint.pformat(experimentData["tpInfPredT"]))

    auxText.append("\nVerbose Output:")
    auxText.append(experimentData["verboseOutput"])

    # auxText.append("Weak Match Pred Cols")
    # auxText.append(pprint.pformat(experimentData["predictedCols"]))


    #auxText.append("\nDecrements")
    #auxText.append(pprint.pformat(zip(experimentData.SPBUOut,
    #                                  experimentData.nConnectedInputs)))

    # auxText.append("\nBit Histories")
    # auxText.append(pprint.pformat(experimentData["bitHistories"]))


    return '\n'.join(auxText)
