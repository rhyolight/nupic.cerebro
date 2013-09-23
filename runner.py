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
import pprint


from collections import namedtuple
from Queue import Empty
import Queue

from experiment_db import ExperimentDB



import nupic.frameworks.opf.opfutils
from nupic.frameworks.opf.opfutils import (InferenceType,
                                           InferenceElement)
import nupic.frameworks.opf.opfhelpers as opfhelpers
import nupic.frameworks.opf.opfbasicenvironment as opfbasicenv
from nupic.frameworks.opf.modelfactory import ModelFactory
from nupic.data.dictutils import DictObj


############################################################################
class Runner(object):
  __FILE_SCHEME = "file://"
  _BATCH_INTERVAL = 10
  CEREBRO_DB_NAME = "CerebroDB"

  def __init__(self,
               name,
               modelDescription,
               control,
               dataset,
               params=None):

    self._modelDescription = modelDescription
    if modelDescription is not None:
      self._model = ModelFactory.create(modelDescription)
      self._model.enableInference(control['inferenceArgs'])
      self._maxiterations = control['iterationCount']

    self.name = name
    self._dataset = dataset
    self.predictedField = control['inferenceArgs']["predictedField"] #modelDescription['predictedField']

    #Figure out prediction field
    fieldInfo = self._model.getFieldInfo()
    self.fieldNames = [info.name for info in fieldInfo]

    # State variables
    self.fields = None

    self.predictionFieldIndex = self.fieldNames.index(self.predictedField)
    self.fieldRanges = self.getFieldRanges()

    # We store the prediction from the previous timestep
    # so that we can compare it to the current timestep

    self.prevPredictedCols = None
    self.prevPredictedConfs = None
    self.prevTPPredicted = None
    self.prevSensorPredicted = None
    self._iteration = 0
    self._maxwait = 25 # *0.2 for seconds
    self._nwait = 0

    # Helper process
    self.process = None

    # -----------------------------------------------------------------------
    # Communication objects
    # -----------------------------------------------------------------------
    self._stop = threading.Event()
    self._isFinished = threading.Event()
    self._batching = threading.Event()
    self._dataQ = Queue.Queue()

  ############################################################################
  def getModel(self):
    return self._model

  ############################################################################
  def getFieldRanges(self):
    return self.fieldRanges

  ############################################################################
  def getFieldNames(self):
    return self.fieldNames

  ############################################################################
  def run(self):
    import gevent
    from gevent import monkey; monkey.patch_all()

    # p = multiprocessing.Process(target = self._runExperimentLoop,
    #                             args=(self._dataQ,))
    # p.daemon = True

    # try:
    #   p.start()
    # except:
    #   raise

    import gevent.queue as gevent_queue
    self._dataQ = Queue.Queue()
    gevent.spawn(self._runExperimentLoop, self._dataQ)


  def load(self):
    import gevent
    from gevent import monkey; monkey.patch_all()
    import gevent.queue as gevent_queue
    self._dataQ = Queue.Queue()
    gevent.spawn(self._runExperimentLoadLoop, self._dataQ)

  def _runExperimentLoadLoop(self, queue):
    collection = ExperimentDB.getExperimentDB(self.name)
    experimentData = collection.find()
    for record in experimentData:
      self._dataQ.put(record)
      gevent.sleep(0)

  ############################################################################
  def stop(self):
    self._stop.set()

  ############################################################################
  def isFinished(self):
    return self._isFinished.isSet()

  ############################################################################

  def __unsetBatchMode(self):
    self._batching.clear()

  def getNewData(self):
    """ Gets the most recent predictions from the ExperimentRunner.
    Note: Once this function is called, the data is consumed and it will no
    longer be stored in the ExperimentRunner
    """
    data = []

    while True:
      shouldBlock = True
      timeout =  0.2
      try:
        newData = self._dataQ.get(shouldBlock, timeout)
        data.append(newData)
        if self._isFinished.isSet() or len(data) >= self._BATCH_INTERVAL:
          break
      except Empty:
        if self._nwait >= self._maxwait:
          self._isFinished.set()
          return None
        self._nwait += 1

    return data

  ############################################################################
  def getFieldRanges(self):
    return self.fieldRanges


  def getFieldRanges(self):
    encoder = self._model._getSensorRegion().getSelf().encoder
    assert isinstance(encoder, nupic.encoders.multi.MultiEncoder)
    # Gather the encoded fields
    self.fields = [x[0] for x in encoder.getDescription()]
    fieldRanges = {}
    encoderWidth = encoder.getWidth()
    description = encoder.description
    for i, (fieldname, offset) in enumerate(encoder.description):
      nextOffset = encoderWidth
      if i < len(description) - 1:
        nextOffset = description[i+1][1]
      fieldRanges[fieldname]  = (offset, nextOffset)

    return fieldRanges


  def auxText(self, experimentData, timestep):
    return ""


  def getDataAtTime(self, dataInput):
    timestep = int(dataInput['timestep'])
    collection = ExperimentDB.getExperimentDB(self.name)
    experimentData = collection.find_one({"_id":timestep})
    return experimentData

  def setName(self, name):
    oldname = self.name
    if not self._isFinished.is_set():
      return {'oldname': oldname, 'name': self.name, 'error': \
        'Experiment is currently running.'}

    result = ExperimentDB.rename(oldname, name)
    if 'error' not in result:
      self.name = name
    return result
