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
function LineGraph(canvasID, width, height){
  this.elem = document.getElementById(canvasID);
  $(this.elem).width(width)
  $(this.elem).height(height)
  
  this.width = width;
  this.height = height;
  this.data = [];
  this.currentTimestep = null;
  
  this.canRedraw = true;
  
  //Add methods
  this.addDataPoint = _addDataPoint;
  this.setdata = _setData;
  this.clear = _clear;
  this.getTimestepData = _getTimestepData;
  
  
  //Setup plot using flot
  this.options = {grid:{clickable: true}}
  $(this.elem).bind("plotclick", this.getTimestepData)
  this.clear()
}


/* Adds data point dataPt to the series
  seriesNum */
function _addDataPoint(seriesNum, dataPt){
  if(!this.data[seriesNum]){
    this.data[seriesNum] = [[0,dataPt]]
  }
  else{
    this.data[seriesNum].push([this.data[seriesNum].length, dataPt])
  }
  
  var l = this.data[0].length
  
  if(this.canRedraw){
    
    if(l > 100)
      this.options['xaxis'] = { min: l-100, max: l};
    else
      this.options['xaxis'] = { min: 0, max: 100 };
      
    $.plot($(this.elem), this.data, this.options);
    
    this.canRedraw = false
    setTimeout(function(graph){
        graph.canRedraw = true
    }, 30, this )
  }
}

function _setData(seriesNum, data){
  var dataWithX = []
  for (var i in data){
    dataWithX.push([i, data[i]])
  }
  
  this.data[seriesNum] = dataWithX
  this.plot.setData(this.data)
  this.plot.draw()
}


function _clear(){
  this.data = []
  
  var options = {xaxis: { min: 0, max: 100 }};
  this.plot = $.plot($(this.elem), this.data, options);
  
  this.plot.draw()
}

function _getTimestepData(event, pos, item){
  $.post('getDataAtTime', {time:pos}, function(data){
    })
}

