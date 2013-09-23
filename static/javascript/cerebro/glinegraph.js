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
  "anomaly":[1,0]
}

function LineGraph(canvasID, width, height){
  
  this.elem = document.getElementById(canvasID);
  this.containerId = "containerId";
  $(this.elem).width(width)
  $(this.elem).height(height)
  
  this.width = width;
  this.height = height;
  this.dataCB = null;
  this.dataTables = {};
  this.shifts = {"prediction":1};
  this.maxShift = 0;
  
  this.period = $("#periodInput")
  
  this.canRedraw = true;
  
  //Add methods
  this.addDataPoint = _addDataPoint;
  this.clear = _clear;
  this.getTimestepData = _getTimestepData;
  this.createDataColumns = _createDataColumns;
  
  this.shouldDraw = true;
  this.onData = _onData;
  
  this.dashboard = new google.visualization.Dashboard(
             document.getElementById('modelDashboard'));
  control = this.control = new google.visualization.ControlWrapper({
    'controlType': 'ChartRangeFilter',
    'containerId': 'control',
    'options': {
      // Filter by the date axis.
      'filterColumnIndex': 0,
      'ui': {
        'chartType': 'LineChart',
        'chartOptions': {
          'chartArea': {'height':50, 'width': "95%"},
          'hAxis': {'baselineColor': 'none'}
        },
        'minRangeSize': 86400000
      }
    },
    // Initial range: 2012-02-09 to 2012-03-20.
    'state': {'range': {'start': 0, 'end': 1}}
  });
  
  chart = this.chart = new google.visualization.ChartWrapper({
    'chartType': 'LineChart',
    'containerId': canvasID,
    'options': {
      // Use the same chart area width as the control for axis alignment.
      'chartArea': {'height': "80%", 'width': "95%"},
      'legend':{'position':'in'},
      'vAxis':{'textPosition':'in'},
      'pointSize':4,
    }
  });
  
  this.anomalyChart= new google.visualization.ChartWrapper({
    'chartType': 'LineChart',
    'containerId': graph2,
    'options': {
      // Use the same chart area width as the control for axis alignment.
      'chartArea': {'height': "100%", 'width': "95%"},
      "vAxis":{
        "viewWindow":{"min":0.0, "max":1.0},
        "textPosition":'in'
      }
    }
  });
  
  
  
  
  this.dashboard.bind(this.control, [this.chart, this.anomalyChart]);
  
  var data = this.data = new google.visualization.DataTable();
  this.dashboard.draw(data);
  this.clear();
  
  
  //for(pltIndex in )
  google.visualization.events.addListener(this.chart, 'select', $.proxy(function(){
    var selection = this.chart.getChart().getSelection()
    if(selection[0]){
      var row = Math.ceil(this.control.getState().range.start) + selection[0].row
      var iteration = this.data.getValue(row, 0)
      this.getTimestepData(iteration)    
    }
  }, this))
  
  var me = this;
  
  this.keyAttached = false;
  
  google.visualization.events.addListener(this.chart, 'ready', function(){
    if(!me.keyAttached){
      
      var keyElement = $(document)
      //Attach Keydown Listener
      keyElement.keydown(
      function(event){
        if(event.which == 37 || event.which ==39)
        {
          var selection = me.chart.getChart().getSelection();
          if(selection[0]){
            var row = selection[0].row;
            var delta = event.which == 37 ? -1 : 1;
            if(event.shiftKey){
              delta *= parseInt( me.period.val() )
            }
            var range = me.control.getState().range;
            row += delta;
            row = Math.min(Math.max(row, 0), range.end-range.start);
            me.chart.getChart().setSelection([{"row":row, "column":selection.column}]);
          }
        }
      })
      
      //Attach Keyup Listener
      keyElement.keyup(
        function(event){
          if(event.which !=37 && event.which !=39)
            return;
          var selection = me.chart.getChart().getSelection();
          if(selection[0]){
            google.visualization.events.trigger(me.chart, 'select',
                                              {"row":selection[0].row,
                                              "column":selection[0].column});
          }
        }
      )
      me.keyAttached = true;
  }
  });
  
  this.control.setState({'range': {'start': 0, 'end': 1}})
  this.control.draw()
  this.dashboard.draw(this.data)
}



function _createDataColumns(dataPt){
  var predictionView = new google.visualization.DataView(this.data);
  var anomalyView = new google.visualization.DataView(this.data);
  
  var predictionCols = [0];
  var anomalyCols = [0];
  
  
  this.maxShift = 0;
  
  // Create Data tables
  this.keys = Object.keys(dataPt)
  for (var i = 0 in this.keys){
    var key = this.keys[i];
    this.data.addColumn(typeof(dataPt[key]), key, key)
    if(key in this.shifts)
      this.maxShift = Math.max(this.shifts[key], this.maxShift);
    var curColumn = this.data.getNumberOfColumns()-2;
    
    if(this.keys[i] == "anomaly")
      anomalyCols.push(curColumn)
    else
      predictionCols.push(curColumn)
      
  }
  
  //Remove Dummy Column
  this.data.removeColumn(1)
  
  if(anomalyCols.length >1){
    anomalyView.setColumns(anomalyCols);
    this.anomalyChart.setView(anomalyView.toJSON())
  }
  
  predictionView.setColumns(predictionCols);
  this.chart.setView(predictionView.toJSON())
  
  
    
  //-----------------------------------------------------------------------
  //Create Charts Data views
  
  // Find the last chart we have to create
  maxChartIdx = 0;
  for(var key in DisplayMap){
    if(DisplayMap[key][0] > maxChartIdx)
      maxChartIdx = DisplayMap[key][0]
  }
  
  // Find the last 
  for(var i=1; i < this.data.getNumberOfRows(); i++){
    colName = this.data.getColumnLabel(i);
    chartIdx = DisplayMap[colName][0];
    if(!this.charts[chartIdx]){
      this.addChart(j);
    }
  }
}



function _addDataPoint(dataPt){
  //Create the appropriate data for the columns, if it doesn't exist
  if(!this.keys)
    this.createDataColumns(dataPt)
  
  var nCols = this.data.getNumberOfColumns();
  var i = 0;
  while(this.data.getNumberOfRows() < this.iteration + this.maxShift + 1){
    var dataRow = new Array(nCols);
    dataRow[0] = this.data.getNumberOfRows();
    for(var j = 1; j < nCols; j++)
      dataRow[j] = null;
    this.data.addRow(dataRow)
    i++;
  }
  
  //Add the data to the new row
  for(var c=1; c < this.data.getNumberOfColumns(); c++){
    var label = this.data.getColumnId(c);
    var shift = 0;
    if(label in this.shifts)
      shift = this.shifts[label];
      
    this.data.setValue(this.iteration + shift, c, dataPt[label]);
  }
  
  // Update Iteration count
  this.iteration++
  
  //Update control slider state
  var low = Math.max(this.iteration - 50, 0)
  this.control.setState({'range': {'start': low, 'end': this.iteration + this.maxShift-1}})
  
  //Redraw
  if (this.shouldDraw){
  
    // this.getTimestepData(this.iteration)
    this.dashboard.draw(this.data)
    
    
    
    this.shouldDraw = false;
    setTimeout(function(ctx){ctx.shouldDraw=true;}, 50, this)
  }
}



function _clear(){
  this.keys = null;
  this.iteration  = 0;
  this.data = new google.visualization.DataTable();
  this.data.addColumn('number', 'Iteration');
  this.data.addColumn('number', 'Dummy');
  
  var view = new google.visualization.DataView(this.data);
  view.setColumns([0,1]);
  this.chart.setView(view.toJSON())
  this.anomalyChart.setView(view.toJSON())
  
  
  this.charts = [this.chart]
  this.views = []
  
  
  this.dashboard.draw(this.data)
}

function _onData(dataFn){
  this.dataCB = dataFn
}

function _getTimestepData(pos){
  $.post('getDataAtTime', {timestep:pos}, $.proxy(function(data){
      this.dataCB(data)
    }, this),'json')
}
