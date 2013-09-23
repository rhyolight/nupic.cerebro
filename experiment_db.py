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

import json
import pymongo
from pprint import pprint

class ExperimentDB(object):

  _ptr = None

  @staticmethod
  def instance():
    if not ExperimentDB._ptr:
      ExperimentDB._ptr = ExperimentDB()
    return ExperimentDB._ptr


  def __init__(self):
    self.dbname = 'ExperimentDatabase'

    self.dbConnection = pymongo.Connection()
    self.db = self.dbConnection["CerebroDB"]
    self.collection = self.db[self.dbname]


  @staticmethod
  def add(name, metadata):
    db = ExperimentDB.instance()

    if name == db.dbname:
      return False

    val = dict(
      name=name,
      metadata=json.dumps(metadata)
    )

    # Clear and reset the experiment database
    db.db.drop_collection(name)
    temp_collection = db.db[name]

    # Add / modify the experiment record
    currentRecord = ExperimentDB.instance().get(name)
    if currentRecord is not None:
      currentRecord['name'] = name
      db.collection.update({"name":name}, currentRecord)
    else:
      db.collection.insert(val)
    return True


  @staticmethod
  def rename(oldname, name):
    # Rename experiment record
    currentRecord = ExperimentDB.get(oldname)
    if currentRecord is not None:
      currentRecord['name'] = name
      ExperimentDB.instance().collection.update({"name":oldname}, currentRecord)
    else:
      return {'oldname': oldname, 'name': oldname, \
        'error': 'Experiment not found.'}

    # Rename experiment database
    try:
      collection = ExperimentDB.getExperimentDB(oldname)
    except Exception:
      return {'oldname': oldname, 'name': oldname, \
        'error': 'Experiment does not exist.'}

    try:
      collection.rename(name)
    except Exception, e:
      pprint(e)
      return {'oldname': oldname, 'name': oldname, \
        'error': 'Experiment name already exists.'}

    # Success
    return {'oldname': oldname, 'name': name}



  @staticmethod
  def get(name):
    item = ExperimentDB.instance().collection.find({"name": name})
    assert(item.count() <= 1)

    if item.count() == 0:
      return None

    item = item[0]
    return item


  @staticmethod
  def getExperimentDB(name):
    db = ExperimentDB.instance()
    return db.db[name]


  @staticmethod
  def list():
    names = ExperimentDB.instance().db.collection_names()
    if 'system.indexes' in names:
      names.pop(names.index('system.indexes'))
    if 'ExperimentDatabase' in names:
      names.pop(names.index('ExperimentDatabase'))
    return names


  @staticmethod
  def delete(name):
    names = ExperimentDB.instance().db.collection_names()

    if name not in names:
      return json.dumps(dict(error="Model name not found."))

    ExperimentDB.instance().db.drop_collection(name)
    ExperimentDB.instance().collection.remove({"name": name})
    return json.dumps(dict(delete=True))
