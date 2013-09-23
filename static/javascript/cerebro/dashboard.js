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
$(document).ready( function() {

  var chartDefs = [
    {
      "dim": {"width": 500, "height": 400},
      "options": {
        "showRangeSelector": true
      },
      "fields": [
        {"name":"actual", "type": "number"},
        {"name":"prediction", "type": "number", "shift": 1},
      ]
    },
    {
      "dim": {"width": 500, "height": 100},
      "options": {
        "showRangeSelector": false,
      },
      "fields": [
        {"name":"anomaly", "type": "number"},
      ]
    }
  ]

  var dashboardTab = "experimentTab";

  var runBtn = "runButton";
  var stopBtn = "stopButton";
  var saveBtn = "saveResultsButton";

  // Dashboard plot elements
  var hintonPlot = "hintonPane";
  var encoderHinton = "encoderHintonContainer";
  var dashboardPane = "dashboardPane"
  var auxText = "auxText";
  var chartArea = "chartGroupDiv";
  var jump = "jumpInput";

  var chartGroup = null;
  var selectedTimestep = 0;
  var fieldHintons = {};


  function _convertCategoryData (pt) {
    var actualValue = pt.actual
    var predictedValue = pt.prediction

    actualNum = 0;
    predictedNum = 0;
    for(var j = 0 in actualValue)
      actualNum += actualValue.charCodeAt(j);
    for(var j = 0 in predictedValue)
      predictedNum += predictedValue.charCodeAt(j);

    actualValue = actualNum % 101;
    predictedValue = predictedNum % 101;

    pt.actual = actualValue;
    pt.prediction = predictedValue;
  }


  function handleDataPoint (pt) {
    if (typeof(pt.prediction) == 'string')
      _convertCategoryData(pt);
    chartGroup.setData(pt);
  }


  function handleExpInfo (expInfo) {
    console.log(expInfo);
    setupFieldHintons(expInfo.fieldInfo);
  }


  function clearPrevExperiment () {
    chartGroup.clearAll();
    fieldHintons = {};
    $('#' + encoderHinton).empty();
  }


  function setupCharts(){
    chartGroup = new ChartGroup(chartArea, chartDefs);
    chartGroup.init();
    for (var i = 0; i < chartGroup.charts.length; i++) {
      var curChart = chartGroup.charts[i][1];
      curChart.on('click', function(e, x, points){
        getDataAtTime(x);
      })
    }
  }

  function setupFieldHintons (fieldInfo) {
    var container = $('#' + encoderHinton);
    for(field in fieldInfo){
      if(!fieldInfo[field])
        continue;
      console.log(field)
      var id = field + "Hinton";
      var label = $("<div class='span1'><b>" + field + "</b></div>");
      var plot  = $("<div></div>").attr("id", id)
                                  .addClass("hinton")
                                  .addClass("span11");
      $("<div/>").addClass('row-fluid')
                 .append(label)
                 .append(plot)
                 .appendTo(container);

      fieldHintons[field]  = new Hinton(id, 1000, 100, 1,
                                        fieldInfo[field]['size'], true);

    }
  }


  function getDataAtTime (t) {
    if(!$("#" + dashboardTab).hasClass("active"))
      return;
    selectedTimestep = t;
    Experiment.getInfoAtTime(t, 'details', _handleTimestepInfo);
  }


  function _handleTimestepInfo (data) {
    // Display selection on charts
    for (var i = 0; i < chartGroup.charts.length; i++) {
      chartGroup.charts[i][1].getNugraph().setSelection(selectedTimestep, true);
    }

    //Display SP bits
    mainHinton.setData({"activeCells": data.SPBUOut,
                        "predictedCells": data.tpPredicted});
    //Display Encoder bits
    for(field in data.fieldActivations){
      if(!(field in data.fieldPredictions))
        data.fieldPredictions[field] = [];

      fieldHintons[field].setData({"activeCells":
                                      data.fieldActivations[field],
                                   "predictedCells":
                                      data.fieldPredictions[field]
                                  })
    }

    $("#" + auxText).html(data.auxText)
  }


  function handleKeyDown(event){
    if(!$("#" + dashboardTab).hasClass("active"))
      return;

    if(event.which ==37 || event.which ==39){
      var delta = event.which == 37 ? -1 : 1;
      if(event.shiftKey){
        delta *= parseInt($('#'+jump).val());
      }
      selectedTimestep += delta;
      return false;
    }
  }


  function handleKeyUp (event) {
    if(event.which ==37 || event.which ==39)
      getDataAtTime(selectedTimestep);
      return false;
  }


  //Setup View
  setupCharts();
  var mainHinton = new Hinton("mainHinton", 600, 600, 46, 45);
  $("#" + hintonPlot).position({
    of:$("#" + dashboardPane),
    my:"left top",
    at:"right top",
    collision:"none"})


  // Bind Event Listeners
  $("#" + runBtn).click(function(){
    clearPrevExperiment();
    Experiment.runExperiment("Standard", handleExpInfo);
  });

  $("#" + stopBtn).click(Experiment.stopExperiment);
  $("#" + saveBtn).click(Experiment.saveResults);
  $(document).keydown(handleKeyDown);
  $(document).keyup(handleKeyUp);

  Experiment.addDataListener(handleDataPoint);

});