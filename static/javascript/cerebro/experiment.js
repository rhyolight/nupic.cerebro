/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Numenta, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
Experiment = {}

$(document).ready(function () {
  var _editableEncoderParams = ["n", "w", "type", "timeOfDay", "dayOfWeek"];
  var _defaultModelData = null;
  var _currentModelData = null;
  Experiment.dataListeners = [];



  Experiment.sendExperimentFile = function (baseFile, subFile, callback){
      var formData = new FormData();
      formData.append("experimentFile", baseFile);
      formData.append("subExperimentFile", subFile);

      var xhr = new XMLHttpRequest();
      xhr.open("POST", "loadDescriptionFile");
      xhr.send(formData);
      xhr.onreadystatechange=function(){
        if (xhr.readyState==4 && xhr.status==200){
          if(callback)
            callback(xhr.responseText);
        }
      }
    }


  Experiment.createFunctionDataset = function (fnText, numIterations, callback){
    $.post("createDataset", {text: fnText, iterations: numIterations},
           function(data){
            callback(data);
          })
  }


  Experiment.setModelParams = function(paramsText) {
    var foo = $.post("setModelParams", {'params': paramsText});
    return foo;
  };


  Experiment.addDataListener = function(dataCB) {
    Experiment.dataListeners.push(dataCB);
    return Experiment.dataListeners.length -1;
  }


  Experiment.removeDataListener = function (handle) {
    Experiment.dataListeners.pop(handle);
  }


  Experiment._handleData = function (data) {
    for(var i=0; i < data.results.actual.length; ++i){
      // Unroll the data
      var pt  =  {};
      $.each(data.results, function(key, value){
        pt[key] = value[i];
      })

      // Send the point to each listener
      for (var j = 0; j < Experiment.dataListeners.length; j++) {
        if(Experiment.dataListeners[j])
          Experiment.dataListeners[j](pt);
      }
    }

    //If there is more data, poll again
    if(!data.finished){
      $.post("getPredictions", Experiment._handleData, "json");
    }
  }


  Experiment.runExperiment = function(type, receiverCB){
    $.post("runExperiment", {'type': type}, function(expData){
      receiverCB(expData);
      $.post("getPredictions", Experiment._handleData, "json");
    }, "json");
  }


  Experiment.stopExperiment = function(){
    $.post("stopCurrentExperiment", function(){
        $.post("getPredictions", Experiment._handleData, "json")
      })
  }


  Experiment.getInfoAtTime = function(timestep, type, callback) {
    $.post('getDataAtTime', {"type": type, 'timestep':timestep}, callback, 'json');
  };

  Experiment.save = function(){
    $.post("experiment/rename", {name: $("#experimentName").val()}, function(data){
      console.log(data);
      if('error' in data && data['error'].length > 0){
        message = data['error'];
      } else {
        message = "Model Saved.";
      }
      $("#saveResultsMessage").fadeIn(500);
      $("#saveResultsMessage").html(message);
      $("#saveResultsMessage").delay(1500).fadeOut(500);
    },'json');
  }


  Experiment.delete = function(name, cb){
    $.post("experiment/delete", {name: name}, function(data){
      if(cb){
        cb(data);
      }
    },'json');
  }


  Experiment.load = function(type, receiverObj, name){
    $.post("experiment/load", {'type': type, 'name': name}, function(recObj){
      return function(data){
        console.log(data);
        $("#experimentName").val(data.name);
        $.post("getPredictions", function(rObj){
          return function(data) {
            return receiveData(data, rObj);
          }
        }(recObj), "json")
      }
    }(receiverObj), "json");
  }


  Experiment.loadList = function(){
    $.get('experiment/list', function(data){
      for(i in data){
        db_name = data[i];
        var option = $("<option></option>").attr({'value':db_name}).html(db_name);
        $("#loadExperimentList").append(option)
      }
    },'json')
  }


  function receiveData(data, receiverCB){
    for(var i=0; i < data.results.actual.length; ++i){

      var pt ={}
      $.each(data.results, function(key, value){
        pt[key] = value[i]
      })

      var actualValue = pt.actual
      var predictedValue = pt.prediction
      if (typeof(predictedValue) == 'string'){
        actualNum = 0
        predictedNum = 0
        for(var j = 0 in actualValue)
          actualNum += actualValue.charCodeAt(j)
        for(var j = 0 in predictedValue)
          predictedNum += predictedValue.charCodeAt(j)

        actualValue = actualNum % 101
        predictedValue = predictedNum % 101
      }

      pt.actual = actualValue
      pt.prediction = predictedValue
      receiverCB(pt)
    }

    //If there is more data, poll again
    if(!data.finished){
      $.post("getPredictions", function(data){
        receiveData(data, receiverCB);
      }, "json");
    }

  }

});


