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

from gevent import monkey; monkey.patch_all()
import web
import os
from cerebro_model import CerebroModel
from experiment_runner import SimulationDataElement
import json
import pprint
import pymongo
from experiment_db import ExperimentDB

USE_MONGO = True


urls = (
  r'^/$', 'index',
  r'^/anomaly$','anomaly',
  r'^/anomaly/setThreshold$','setThreshold',
  r'^/loadDescriptionFile$', 'loadDescriptionFile',
  r'^/runCurrentExperiment$', 'runCurrentExperiment',
  r'^/stopCurrentExperiment$', 'stopCurrentExperiment',
  r'^/setPredictedField$', 'setPredictedField',
  r'^/getPredictions$', 'getPredictions',
  r'^/setModelParams$', 'setModelParams',
  r'^/runExperiment$', 'runExperiment',
  r'^/createDataset$', 'createDataset',
  r'^/saveDataset$', 'saveDataset',
  r'^/saveDescription$', 'saveDescriptionFile',
  r'^/getDataAtTime$', 'getDataAtTime',

  # Managing Experiments
  r'^/experiment/rename$', 'setExperimentName',
  r'^/experiment/list$', 'ExperimentList',
  r'^/experiment/load$', 'loadExperiment',
  r'^/experiment/delete$', 'deleteExperiment'


)


render = web.template.render("templates/")
web.webapi.internalerror = web.debugerror

class index:
  def GET(self):
    f = open("templates/index.html")
    s = f.read()
    f.close()
    CerebroModel.USE_MONGO = USE_MONGO
    return s

class anomaly:
  def GET(self):
    f = open("templates/index_anomaly.html")
    s = f.read()
    f.close()
    CerebroModel.USE_MONGO = USE_MONGO
    return s

class getEngineState:
  def POST(self):
    state = {}
    state['consoleOptions'] = SimulationDataElement._fields
    return json.dumps(state)


class setPredictedField:
  def POST(self):
    cerebro = CerebroModel.get()
    predictedFieldname = web.input()['fieldname']
    cerebro.setPredictedField(fieldname=predictedFieldname)

    return ""

class setModelParams:
  def POST(self):
    cerebro = CerebroModel.get()
    params = eval(web.input()['params'])
    cerebro.setModelParams(params)
    return

class runExperiment:
  def POST(self):
    expType = web.input()["type"]
    cerebro = CerebroModel.get()
    cerebro.name = cerebro.default_name
    results = cerebro.runCurrentExperiment(expType)
    return json.dumps(results)

class loadExperiment:
  def POST(self):
    expType = web.input()["type"]
    name = web.input()["name"]
    cerebro = CerebroModel.get()
    cerebro.name = name
    results = cerebro.runCurrentExperiment(expType, True)
    return json.dumps(results)

class deleteExperiment:
  def POST(self):
    name = web.input()["name"]
    return json.dumps(ExperimentDB.delete(name))


class setThreshold:
  def POST(self):
    newThreshold = web.input()["threshold"]
    cerebro = CerebroModel.get()
    results = cerebro.setClassifierThreshold(newThreshold)
    return json.dumps(results)


class stopCurrentExperiment:
  def POST(self):
    cerebro = CerebroModel.get()
    cerebro.stopCurrentExperiment()
    return ""

class getPredictions:
  def POST(self):
    cerebro = CerebroModel.get()
    returnData = json.dumps(cerebro.getLatestPredictions())
    web.header("Content-Type", "application/json")
    return returnData

class getDataAtTime:
  def POST(self):
    """ Get information about the current model at a specific timestep"""
    cerebro = CerebroModel.get()
    dataInput = dict(web.input())
    data = cerebro.getDataAtTime(dataInput)
    web.header("Content-Type", "application/json")
    return json.dumps(data)

class loadDescriptionFile:
  def POST(self):
    """ Load a dataset/model from a description.py """
    cerebro = CerebroModel.get()
    params = web.input()
    cerebro.loadDescriptionFile(descriptionFile = params["experimentFile"],
                                subDescriptionFile= params["subExperimentFile"])

    modelDesc = cerebro.getCurrentModelParams()
    return pprint.pformat(modelDesc['modelParams'])


class createDataset:
  def POST(self):
    """ Create a dataset from a function """
    cerebro = CerebroModel.get()
    fnText = web.input()["text"]
    iterations = int(web.input()["iterations"])
    cerebro.createProceduralDataset(fnText, iterations)
    modelDesc = cerebro.getCurrentModelParams()
    return pprint.pformat(modelDesc['modelParams'])

class saveDataset:
  def GET(self):
    """ FIXME: Right now, this returns the csv as a text file, so that the user
    can use the "save file as" button """
    cerebro = CerebroModel.get()
    text = cerebro.getDatasetText()

    web.header("Content-Type", "text/plain")
    web.header('Content-Disposition', "attachment; filename=data.csv")

    return text

class saveDescriptionFile:
  def GET(self):
    """ FIXME: Right now, this returns the csv as a text file, so that the user
    can use the "save file as" button """
    cerebro = CerebroModel.get()
    text = cerebro.getDescriptionText()

    web.header("Content-Type", "text/plain")
    web.header('Content-Disposition', "attachment; filename=description.py")

    return text

# Managing Experiments
class setExperimentName:
  def POST(self):
    """ Save the currently used mongoDB for use later """
    name = web.input()["name"]
    cerebro = CerebroModel.get()
    results = cerebro.setExperimentName(name)
    return json.dumps(results)


class ExperimentList:
  def GET(self):
    return json.dumps(ExperimentDB.list())


app = web.application(urls, globals())

def setup():
  if USE_MONGO:
    import pymongo
    from subprocess import Popen
    import subprocess
    try:
      conn = pymongo.Connection()
    except pymongo.errors.AutoReconnect:
      print "MongoDB not running. Starting..."
      dbPath = os.path.expanduser('~/nta/mongodb/')
      if not os.path.exists(dbPath):
        print 'Directory for the MongoDB files does not exist. Creating ...'
        os.makedirs(dbPath)
      pid =  Popen(["mongod --dbpath ~/nta/mongodb/"], shell=True).pid
      print "MongoDB running with process id", pid


if __name__ == "__main__":
    setup()
    app.run()
