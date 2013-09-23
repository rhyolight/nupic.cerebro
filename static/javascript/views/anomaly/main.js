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
$(document).ready(function(){

  var viewChartBtn = "viewChart";
  var viewArea = "viewArea";

  Globals.charts = [];
  Globals.streams = [];
  Globals.init = true;
  Globals.draw = true;
  Globals.threshold = 80;

  Experiment.loadList()

  Globals.chartDefs = [
    {
      "dim": {"width": $(document).width() - 200, "height": 400},
      "options": {
        "showRangeSelector": false
      },
      "fields": {
        "actual":"number",
        "anomalyLabel": "category"
      }
    },
    {
      "dim": {"width": $(document).width() - 200, "height": 200},
      "options": {
        "showRangeSelector": false,
        "_underlayCB": function(canvas, area, g){
          canvas.fillStyle = "hsla(0, 0% , 0%, 0.5)";
          x = g.toDomXCoord(area.x);
          y = g.toDomYCoord(Globals.threshold);
          canvas.fillRect(area.x, y, area.w, area.h/100);
        }
      },
      "fields": {
        "anomaly": "number",
      }
    }
  ]

  Globals.hinton = new Hinton("mainHinton", 600, 600, 46, 45);
  Globals.subgraphs = new SubGraphs("SubGraphs");

  chartCB = function(e, x, pts){
    $.post('getDataAtTime', {type:'protos',timestep:x}, $.proxy(function(data){
      $("#SubGraphs").fadeIn(500);
      Globals.subgraphs.setData(data['protos']);
    }, this),'json')
  }

  // Create Graphs
  Globals.mainChart = new ChartGroup("viewArea", Globals.chartDefs, {
    "chartCB": chartCB
  });
  Globals.mainChart.init();

  for (var i = 0; i < Globals.mainChart.charts.length; i++) {
    var curChart = Globals.mainChart.charts[i][1];
    curChart.on('zoom', function(startDate, endDate, yRanges){
                                console.log(startDate + " -> " + endDate);
                                console.log(yRanges);
                                console.log(chart)
                                console.log(this)
                                curChart.getNugraph().updateOptions({
                                  dateWindow: null,
                                  valueRange: null
                                });
                              });
  }



  function receiveChartData(dataRow){
    // Add data to streams
    Globals.mainChart.setData(dataRow);
  }

  // Slider
  $( "#slider-vertical" ).slider({
    orientation: "vertical",
    range: "min",
    min: 50,
    max: 120,
    value: Globals.threshold,
    slide: function( event, ui ) {
      Globals.threshold = ui.value / 100;
      $( "#amount" ).val( Globals.threshold );
      Globals.mainChart.redraw();
    },
    change: function(event, ui){
      Globals.threshold = ui.value / 100;
      $( "#amount" ).val( Globals.threshold );
      Globals.mainChart.redraw();
      /*
      $.post("anomaly/setThreshold", {threshold:Globals.threshold},
       function(data){
        console.log(data['labels']);
        Globals.mainChart.setStream("anomalyLabel",data['labels']);
        Globals.mainChart.redraw();
      }, "json")
      */
    }
  });
  $( "#amount" ).val( $( "#slider-vertical" ).slider( "value" ) );

  var recieverObj = {
    addDataPoint: receiveChartData
  };

  // Save main graph image
  $("#imageSaver").click(function(){
    $("#saveImageDiv").show();
    img = document.getElementById('saveImageImg');
    Dygraph.Export.asPNG(Globals.mainChart.charts[0], img);
  });

  // Set Name Of
  $("#saveResults").click(function(){
    Experiment.save();
  });

  // Load an experiment
  $("#loadExperiment").click(function(){
    var name = $("#loadExperimentList").val();
    Experiment.load("Anomaly", recieverObj, name);
    $("#loadModel").fadeOut(1000);
    $("#MainView").delay(1000).fadeIn(1000);
  });

  $("#deleteExperiment").click(function(){
    var name = $("#loadExperimentList").val();
    Experiment.delete(name, function(results){
      $("#loadExperimentList option").each(function(){
        if($(this).val() == name){
          $(this).remove();
        }
      })
    });
  });

  //Upload Description File
  $("#fileUpload").change(function(){
    var fileElem = this;
    $("#loadModel").fadeOut(1000);
    $("#MainView").delay(1000).fadeIn(1000);
    Experiment.sendExperimentFile(this.files[0], null, function(){
      $(fileElem).val(null);
      Experiment.runExperiment("Anomaly",recieverObj);
    })
  });


  // Track Keys Pressed
  var ctrlPressed = false;
  $(window).keydown(function(evt) {
    console.log(evt.which)
    if (evt.which == 17) { // ctrl
      ctrlPressed = true;
    }
  }).keyup(function(evt) {
    if (evt.which == 17) { // ctrl
      ctrlPressed = false;
    }
  });



});
