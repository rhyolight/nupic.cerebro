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

var DATASET = (function () {

  var module = {};

  function Dataset()
  {

    this.dataStreams = [];
    this.dataStreamNameMap = {};
  }
  module.Dataset = Dataset;

  Dataset.prototype.addStream = function(dataStream){
    this.dataStreams.push(dataStream);
    this.dataStreamNameMap[dataStream.getName()] = this.dataStreams.length-1;
  }


  Dataset.prototype.removeStream = function(streamID) {
    var index;
    var name;
    if(typeof streamID == "string"){
      name = streamID;
      index = this.dataStreamNameMap[streamID];
    }
    else if(typeof streamID == "number"){
      index = streamID;
      name = this.dataStreams[index].getName();
    }
    else
      throw new Error("Invalid streamd ID type " + typeof streamID);

    this.dataStreams.remove(index);
    delete x[name];
  };


  Dataset.prototype.numStreams = function() {
    return this.dataStreams.length;
  };


  Dataset.prototype.getStream = function(streamID) {
    if(typeof streamID == "string"){
      if(!(streamID in this.dataStreamNameMap))
        return null;
      return this.dataStreams[this.dataStreamNameMap[streamID]];
    }
    else if(typeof streamID == "number"){
      if(streamID < 0 || streamID >= this.dataStreams.length)
        return null;
      return this.dataStreams[streamID];
    }
    else
      throw new Error("Invalid streamd ID type " + typeof streamID);
  };


  Dataset.prototype.getHTMLTable = function() {
    var table = document.createElement("table");
    table.appendChild(document.createElement("thead"));
    table.appendChild(document.createElement("tbody"));

    // Write header
    var row = document.createElement("tr");
    for (var i = 0; i < this.dataStreams.length; i++) {
      var name = this.dataStreams[i].getName();
      $("<td></td>").text(name).appendTo(row);
    }

    $(table).find("thead").append(row);

    // Write data rows
    var numRows = this.dataStreams[0].size();
    for (var i = 0; i < numRows; i++) {
      row = document.createElement("tr");
      for (var j = 0; j < this.dataStreams.length; j++) {
        var val = this.dataStreams[j].get(i);
        $("<td></td>").text(val).appendTo(row);
      }
      $(table).find("tbody").append(row);
    }

    return table;
  };



  function DataStream(name, type, data)
  {
    this.name = name;
    this.type = null;
    this.data = [];

    if(type !== undefined)
      this.type = type;
    if(data !== undefined)
      this.data = this.data.concat(data);
  }
  module.DataStream = DataStream;

  DataStream.prototype.getName = function () {
    return this.name;
  }

  DataStream.prototype.getType = function () {
    return this.type;
  }

  DataStream.prototype.setType = function(type) {
    this.type = type;
  }

  DataStream.prototype.setData = function(data) {
    this.data = data;
  };

  DataStream.prototype.addData = function(data) {
    if (data instanceof Array)
      this.data.concat(data);
    else
      this.data.push(data);
  };

  DataStream.prototype.get = function(start, end) {
    if(end !== undefined)
      return this.data.slice(start, end);
    else
      return this.data[start];
  };

  DataStream.prototype.size = function() {
    return this.data.length;
  };

  return module;
}());