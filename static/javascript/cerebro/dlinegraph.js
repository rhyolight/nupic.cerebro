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
var DisplayMap = {
  "actual":[0,0],
  "prediction":[0,1],
}

var ChartOptions = [
  {width:600, height:400},
]

function LineGraph(canvasID, width, height){

  this.elem = document.getElementById(canvasID);

  this.containerId = "containerId";

  this.width = width;
  this.height = height;
  this.dataCB = null;
  this.dataArrays= [];
  this.charts = [];
  this.datas = [];
  this.shifts = {"prediction":  1};
  this.maxShift = 0;

  this.period = $("#periodInput")

  this.iteration = 0
  this.canRedraw = true;
  this.shouldDraw = true;

  var me = this;
  this.keyAttached = false;
  this.selectedTimestep = 0;

  if(!me.keyAttached){

    var keyElement = $(document)
    //Attach Keydown Listener
    keyElement.keydown(
    function(event){
      if(event.which == 37 || event.which ==39)
      {
        var row = me.selectedTimestep;
        var delta = event.which == 37 ? -1 : 1;
        if(event.shiftKey){
          delta *= parseInt( me.period.val() )
        }
        row += delta;
        me.selectedTimestep = row;
        me.charts[0].setSelection(row, "actual", true)
      }
    })

    //Attach Keyup Listener
    keyElement.keyup(
      function(event){
        if(event.which !=37 && event.which !=39)
          return;

        me.getTimestepData(me.selectedTimestep);

      }
    )
    me.keyAttached = true;
  }

}

LineGraph.prototype._createDataTable = function(dataPt) {
  var keys = Object.keys(dataPt)

  // Get the labels for each chart
  this.labels = []
  for (var i = keys.length - 1; i >= 0; i--) {
    key = keys[i];
    if (key in DisplayMap) {
      var chartNum = DisplayMap[key][0];
      var seriesNum = DisplayMap[key][1];
      if(!this.labels[chartNum])
        this.labels[chartNum] = ["iteration"];
      this.labels[chartNum][seriesNum+1] = key;
    }
  }

  for (var i = 0; i < this.labels.length; i++) {
    var chartLabels = this.labels[i];
    $(this.elem).append("<div class='plot'></div>");
    var chartDiv = this.elem.lastChild;
    $(chartDiv).attr("id", "graph" + i);
    $(chartDiv).width(ChartOptions[i].width);
    $(chartDiv).height(ChartOptions[i].height);

    var me = this
    this.charts.push(new Nugraph("#graph"+i,
                                  {labels: chartLabels,
                                    clickCallback:function  (e,  x, pts) {
                                      me.getTimestepData(x)
                                    }})
                    );

    var meChart = me.charts[i];
    var initData = [[], []];
    for (var j = 0; j < chartLabels.length; j++) {
      initData[0].push(j* 10)
      initData[1].push(1 + j*10)
    };

    this.datas.push(new Nudata({
            'source' : { 'dataArray' : initData},
            'parseDates': false,
            'refreshCallback' : function(data, refreshType, opts) {
              meChart.refresh(data, refreshType, opts);
            }
        }))

    me.dataArrays[i] = []

  }

};

LineGraph.prototype.addDataPoint = function(dataPt) {

  //Create the appropriate data for the columns, if it doesn't exist
  if(!this.labels)
    this._createDataTable(dataPt)

  var labels = this.labels

  for (var chartIdx = 0; chartIdx < labels.length; chartIdx++) {
    var chartLabels = labels[chartIdx]
    chartArray =  this.dataArrays[chartIdx];

    for (var seriesIdx = 0; seriesIdx < chartLabels.length; seriesIdx++) {
      var label = chartLabels[seriesIdx];
      var shift = 0;
      if(label in this.shifts)
        shift = this.shifts[label];
      var rowIdx = this.iteration + shift;
      for(var j=this.iteration; j <= rowIdx; j++){
        if(!chartArray[j]){
          var len = chartLabels.length;
          var row = [];
          while(--len >= 1)
            row[len] = null;
          row[0] = j;
          chartArray[j] = row;
        }

      }

      if(seriesIdx != 0){
        chartArray[rowIdx][seriesIdx] = dataPt[label];
      }
    }

    this.dataArrays[chartIdx] = chartArray
    // Redraw graph if ready
    if(this.shouldDraw && this.iteration > 0){
        this.datas[chartIdx].resetData(this.dataArrays[chartIdx])
        break;
    }
  }

  // Set draw timeout
  if(this.shouldDraw){
    // this.getTimestepData(this.iteration)
    this.shouldDraw = false
    setTimeout(function(ctx){ctx.shouldDraw=true;}, 50, this)
  }

  // Update Iteration count
  this.iteration++

};


LineGraph.prototype.clear = function() {
  this.labels = null;
  this.iteration  = 0;

  delete this.data
  this.data = [];
  this.charts = [];
  this.datas = [];

  $(this.elem).empty()

};

LineGraph.prototype.onData = function(dataFn) {
  this.dataCB = dataFn
};

LineGraph.prototype.getTimestepData = function(pos) {
  $.post('getDataAtTime', {type: 'details', timestep:pos}, $.proxy(function(data){
      this.dataCB(data);
      this.selectedTimestep = pos;
    }, this),'json')
};
