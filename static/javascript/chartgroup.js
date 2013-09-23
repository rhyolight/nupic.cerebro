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

var ChartGroup = function(idDiv, chartDefs, options){
  if(!options){
    options = {};
  }

  this.idDiv = idDiv;
  this.chartDefs = chartDefs;
  this.streams = {};
  this.streamProperties = {};
  this.charts = [];
  this.reset = true;
  this.draw = true;

  this.stop_draws = false;

  this.options = options;
}


ChartGroup.prototype.init = function(){
  area = $("#"+this.idDiv);
  firstChart = null;
  for (var i = 0; i < this.chartDefs.length; ++i) {


      var chart = new CHART.Chart(this.options['chartCB']);
      for(key in this.chartDefs[i].options){
        chart.options[key] = this.chartDefs[i].options[key];
      }
      var chartWrapperHTML = ["<div class='container'>",
                            "<div class='row'></div>",
                          "</div>"].join("");
      var chartWrapper = $(chartWrapperHTML);
      var chartDiv = $("<div></div>").attr("id", "chart"+i)
                                      .addClass("span10")
                                      .appendTo(area)
                                      .wrap(chartWrapper);

      var spec = this.chartDefs[i].fields;
      for (key in spec) {
        var info = spec[key];
        var name = info.name;
        var type = info.type;

        if(!(name in this.streams)){
          this.streams[name] = new DATASET.DataStream(name, type, [0]);
        }

        if(!(name in this.streamProperties))
          this.streamProperties[name] = info;

        chart.addStream(this.streams[name]);
      }
      chart.render(chartDiv.attr("id"));
      chart.setWidth(this.chartDefs[i].dim.width);
      chart.setHeight(this.chartDefs[i].dim.height);
      if(typeof this.chartDefs[i].options['_underlayCB'] == 'function'){
        chart._underlayCB = this.chartDefs[i].options['_underlayCB'];
      }
      if(firstChart){
        chart.syncTo(firstChart);
        firstChart.syncTo(chart);
      } else {
        firstChart = chart;
      }
      this.charts.push([chartDiv.attr("id"), chart]);
  }
}

ChartGroup.prototype.setStream = function(name, data){
  if(name in this.streams){
    this.streams[name].setData(data);
  }
}

ChartGroup.prototype.setData = function(dataRow){
  var maxLength = 0;
  for(name in dataRow){
    if(name in this.streams){
      if(this.reset){
        this.streams[name].setData([]);
      }
      this.streams[name].addData(dataRow[name]);
      maxLength = Math.max(maxLength, this.streams[name].size());
    }
  }

  //Redraw
  if(!this.stop_draws && this.draw){
    this.draw = false;
    setTimeout(function(obj){
        return function(){
          obj.draw = true;
          obj.redraw();
      }
    }(this), 300);
  }

  this.reset = false;
}

ChartGroup.prototype.clearAll = function() {
  for(stream in this.streams)
    this.setStream(stream, [0]);
  this.reset = true;
};


ChartGroup.prototype.redraw = function(){
  for(var i = 0; i < this.charts.length; ++i){
    this.charts[i][1].redraw();
  }
}