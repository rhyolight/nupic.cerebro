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

import random
import numpy
import math

from abc import ABCMeta, abstractmethod
import nupic.frameworks.opf.opfbasicenvironment as opfbasicenv
from itertools import (count)
from nupic.data.fieldmeta import (FieldMetaInfo, FieldMetaType)
from ordereddict import OrderedDict
from nupic.data.dictutils import DictObj

class DatasetIface(object):
  """Interface representing a source of data records. How the records are
  generated is left up to the implmentation. Note that the implentation is only
  guaranteed to generated new records, but doesn't necessarily store previously
  generated records. In this way, it behaves like an iterator
  """
  __metaclass__ = ABCMeta

  @abstractmethod
  def getNextRecord(self):
    """Get the next record from the data source

    Returns:
    An object with an attribute for each field in the dataset
    """

  @abstractmethod
  def getDatasetFieldMetaData(self):
    """Get metadata (name, type, special flag, etc) for each field in the
    dataset

    Returns:
    A list []

    """

  @abstractmethod
  def rewind(self):
    """ Start the dataset reading from the beginning """


# =========================================================================
class FileDataset(DatasetIface):
  def __init__(self, directoryPath):
    self._path = directoryPath
    self._datasetReader =  opfbasicenv.BasicDatasetReader(directoryPath)

  def getNextRecord(self):
    """Get the next record from the data source

    Returns:
    An object with an attribute for each field in the dataset
    """
    return self._datasetReader.next()

  def getDatasetFieldMetaData(self):
    """Get metadata (name, type, special flag, etc) for each field in the
    dataset

    Returns:
    A list []

    """

    return self._datasetReader.getDatasetFieldMetaData()

  def rewind(self):
    """ Start the dataset reading from the beginning """
    self._datasetReader =  opfbasicenv.BasicDatasetReader(self._path)
    return


################################################################################
################################################################################
class ProceduralDataset:

  def __init__(self, fn, iterations, historyBuffer = None):

    random.seed(42)

    self.nIterations = iterations
    self.fn = fn
    self.iterations = iter(xrange(iterations))
    self.history = historyBuffer

    firstRecord = fn(0)
    fieldList = [(name, self.__getType(val), '')
                      for name, val in firstRecord.iteritems()]

    self.__metaData = FieldMetaInfo.createListFromFileFieldList(fieldList)

  ############################################################################
  def getNextRecord(self):
    """Get the next record from the data source

    Returns:
    An object with an attribute for each field in the dataset
    """
    fields = self.fn(next(self.iterations))
    self.history.append(fields)
    return fields

  ############################################################################
  def getDatasetFieldMetaData(self):
    """Get metadata (name, type, special flag, etc) for each field in the
    dataset

    Returns:
    A list []

    """

    return self.__metaData

  ############################################################################
  def rewind(self):
    """ Start the dataset reading from the beginning """
    random.seed(42)
    self.history.clear()
    self.iterations = iter(xrange(self.nIterations))
    return

  ############################################################################
  def __getType(self, val):
    """ Returns the FieldMetaInfo.type value for the given value. If val is
    a dict, the type of the values is used """

    if type(val) in (str, unicode):
      return FieldMetaType.string
    if type(val) is int:
      return FieldMetaType.integer
    if type(val) is float:
      return FieldMetaType.float
    if type(val) is dict:
      return self.__getType(val.values()[0])

    raise TypeError("Can't recognize field type %s" % type(val) )



################################################################################
################################################################################
class SamplingDict(OrderedDict):

  __PrimitiveTypes = (float, int, str, unicode, type(None))

  ############################################################################
  def __setitem__(self, key, value):
    if type(value) not in self.__PrimitiveTypes:
      self[key] = self.__sampleFieldValue(value)
    else:
      super(SamplingDict, self).__setitem__(key, value)

    return value

  ############################################################################
  def __getattr__(self, key):
    if key in self:
      return self[key]
    return super(SamplingDict, self).__getattribute__(key)


  ############################################################################
  def __sampleFieldValue(self, element):
    """ If a field is specified as a probability distribution (currently just
    dicts or lists/sets), select a specific element """

    if type(element) is dict:
      # Get the probabilities and values
      vals = element.keys()
      probs = element.values()
      cumProbs = numpy.cumsum(probs)
      sample = random.uniform(0, cumProbs[-1])
      selected = numpy.where(cumProbs > sample)[0]
      if len(selected) == 0:
        return vals[-1]
      return vals[selected[0]]

    elif type(element) in (set, list, tuple):
      return random.choice(element)