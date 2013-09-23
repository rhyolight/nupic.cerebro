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

$(document).ready(function () {

  var module = {};

  var pallete = [
    "rgba(255, 0, 0, 0.5)",
    "rgba(0, 255, 0, 0.5)",
    "rgba(0, 0, 255, 0.5)",
    "rgba(255, 255, 0, 0.5)",
    "rgba(255, 0, 255, 0.5)",
    "rgba(0, 255, 255, 0.5)",
  ]

  function Chart () {
    this.numericStreams = [];
    this.categoryStream = null;
    this.datetimeStream = null;

    this._category
    this._chart = null;
    this._legendTable = null;
    this._containerID = null;
    this._underlayCB = null;
    this._xoffset = 0;
    this.options = {
      "showRangeSelector": true,
      "showLegend": false
    }
  }

  module.Chart = Chart;

  Chart.prototype.addStream = function(stream) {
    if(stream.getType() == "number")
      this.numericStreams.push(stream);
    else if(stream.getType() == "category")
      this.categoryStream = stream;
    else if (stream.getType() == "datetime")
      this.datetimeStream = stream;
  }

  Chart.prototype.render = function(containerID) {
    var chart_self = this;
    this._containerID = containerID;
    // Handle numerical plots
    var labels = ["iteration"];
    var dataArray = this._getDataArray(labels);
    var chart = new NuGraph(containerID, dataArray,
                            {labels: labels,
                              showRangeSelector: this.options["showRangeSelector"],
                              interactionModel: {
                                'mousedown' : downV3,
                                'mousemove' : moveV3,
                                'mouseup' : upV3,
                                'click' : clickV3,

                                // Double click to zoom to 0%
                                'dblclick' : dblClickV4,

                                // Scroll to zoom
                                'mousewheel' : scrollV3,
                              }
                            });


    //Display category highlighting
    if(this.categoryStream){
      this._highlightedRanges = this._getCategoryRanges(this.categoryStream);
      this._categoryLegend = this._constructCategoryLegend(
                                                      this._highlightedRanges);
      this._displayCategoryLegendTable(this._categoryLegend, this._containerID);
      var cb = this._getUnderlayCallback();
      chart.on('underlay', cb);
    }

    chart.render();
    this._chart = chart;
  }

  Chart.prototype.hide = function(){
    $("#"+this._containerID).hide();
  }

  Chart.prototype.show = function(){
    $("#"+this._containerID).show();
  }

  Chart.prototype.on = function(event, callback) {
    this._chart.on(event, callback);
  };

  Chart.prototype.redraw = function(){
    if(this.categoryStream){
      this._highlightedRanges = this._getCategoryRanges(this.categoryStream);
      this._categoryLegend = this._constructCategoryLegend(
                                                      this._highlightedRanges);
      this._displayCategoryLegendTable(this._categoryLegend, this._containerID);
      var cb = this._getUnderlayCallback();
      this._chart.on('underlay', cb);
    } else {
      this._chart.on('underlay', this._underlayCB);
    }

    var labels = ["iteration"];
    var dataArray = this._getDataArray(labels);
    this._chart._args[1] = dataArray;
    this._chart.render();
  };


  Chart.prototype.syncTo = function(other) {
    this._chart.syncTo(other._chart);
  };


  Chart.prototype.setWidth = function(width) {
    this._chart.resize(width);
  };

  Chart.prototype.setHeight = function(height) {
    this._chart.resize(this._chart.getArea().w, height);
  };

  Chart.prototype.setXOffset = function(offset){
    this._xoffset = offset;
  }

  Chart.prototype.getNugraph = function() {
    return this._chart;
  };

  // *** Private Methods ***
  Chart.prototype._getDataArray = function(labels) {
    // Collect statistics on streams
    var maxLength = -1;
    for (var i = 0; i < this.numericStreams.length; i++){
      var stream = this.numericStreams[i];
      labels.push(stream.getName());
      maxLength = Math.max(stream.size(), maxLength);
    }

    if(this.categoryStream)
      maxLength = Math.max(this.categoryStream.size(), maxLength);

    // Fill data Array
    var dataArray = [];
    for (var rowIdx = 0; rowIdx < maxLength; rowIdx++) {
      var row = [rowIdx+this._xoffset];
      for (var s = 0; s < this.numericStreams.length; s++)
        row.push(this.numericStreams[s].get(rowIdx));
      dataArray.push(row);
    }

    return dataArray;
  }

  Chart.prototype._getCategoryRanges = function(stream) {
    var ranges = [];
    var start = 0;
    var prevVal = stream.get(0);

    for (var i = 1; i < stream.size(); i++) {
      var val = stream.get(i);
      if(val != prevVal){
        ranges.push([start+this._xoffset, i+this._xoffset, prevVal]);
        prevVal = val;
        start = i;
      }
    }

    ranges.push([start+this._xoffset, i+this._xoffset, prevVal]);

    return ranges;
  }


  function getColor (index, numColors) {
    var hue = index / numColors * 255;
    var saturation = 90 + Math.random() * 10;
    var lightness = 40 + Math.random() * 10;

    var saturation = 90 + (index % 3 - 1) * 5;
    var lightness = 40 + (index % 3 - 1) * 5;

    return "hsla(" + hue + ", " + saturation + "% , " + lightness + "%, 0.5)";
  }

  /* Create a mapping from category values to colors */
  Chart.prototype._constructCategoryLegend = function(ranges) {
    var legend = {};
    for (var i = 0; i < ranges.length; i++)
      legend[ranges[i][2]] = null;

    var keys = Object.keys(legend);
    for (var i = 0; i < keys.length; i++) {
      if(keys[i] == "null")
        legend[keys[i]] = "rgba(255, 255, 255, 0)";
      else{
        legend[keys[i]] = getColor(i, keys.length);
      }
    }

    return legend
  };


  Chart.prototype._displayCategoryLegendTable = function(legend, containerID) {
    // Construct the table
    if(!this.options['showLegend']){
      return;
    }
    var keys = Object.keys(legend);

    if(this._legendTable == null){
      this._legendTable = $("<table id='"+containerID+"_legend'><tbody></tbody></table>").addClass("tableLegend");
      // Add the table to dom
      var container = $("#" + containerID).parent("div");
      $("<div></div>").addClass("span2")
                      .appendTo(container)
                      .append(this._legendTable);
    } else {
      $("#"+containerID+"_legend").html("<tbody></tbody>");
    }

    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var color = legend[name];
      var row = $("<tr></tr>").appendTo(this._legendTable.find("tbody"));
      $("<td></td>").css("background-color", color)
                    .appendTo(row);
      $("<td></td>").text(name)
                    .appendTo(row);
    }
  };


  /* Return the dygraph callback function required to render the category
     background
  */
  Chart.prototype._getUnderlayCallback = function() {
    var highlightedRanges = this._highlightedRanges;
    var legend = this._categoryLegend;
    var underlayCB= this._underlayCB;
    return function  (canvas, area, g) {
      canvas.canvas.width = canvas.canvas.width;
      canvas.save();
      canvas.setTransform(1, 0, 0, 1, 0, 0);
      canvas.clearRect(0, 0, canvas.width, canvas.height);
      canvas.restore();

      var i = 0,
      len = highlightedRanges.length,
      xLeft = null,
      xRight = null,
      hRange = null;

      for (i = 0; i < len; i++) {
        hRange = highlightedRanges[i];

        xLeft = g.toDomXCoord(hRange[0]-0.5);
        xRight = g.toDomXCoord(hRange[1]-0.5);

        if(xLeft < area.x + area.w && xRight > area.x){
          canvas.fillStyle = legend[hRange[2]];
          var w = xRight - xLeft;
          canvas.fillRect(xLeft, area.y, w, area.h);
        }
      }
      if(typeof underlayCB == "function"){
        underlayCB(canvas, area, g);
      }
    }

  };


  window.CHART = module;

});