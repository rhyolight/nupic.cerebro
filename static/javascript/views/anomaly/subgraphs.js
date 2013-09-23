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
var SubGraphs = function(id){
  this.id = id
  this.graphs = [];
  this.streams = [];
  this.indexes = [];
  this.num_graphs = 5;

  area = $("#"+this.id);
  area.hide();
  for (var i = 0; i < this.num_graphs; ++i) {
      var chart = new CHART.Chart(function(ctx, ind){
        return function(e, x, pts){
          ctx.chartCB(ind);
        }
      }(this, i));
      chart.options["showRangeSelector"] = false;
      //chart.options["showLegend"] = false;

      this.indexes[0] = 1;
      var chartView = $("<div id='subchart_view_"+i+"'' style='float:left;'><div>")

      var chartHeader = $("<div></div>")
                            .append(
                              $("<div></div>")
                                .html("Class Prototype #"+i)
                            )
                            .append(
                              $("<div></div>")
                                .html("Distance: ")
                                .append(
                                  $("<span id='dist_"+i+"'></span>")
                                    .html(10)
                                )
                            )
                            .append(
                              $("<div></div>")
                                .html("Index: ")
                                .append(
                                  $("<span id='index_"+i+"'></span>")
                                    .html(10)
                                )
                            )
                            .css('text-align','center')
                            .css('font-size','12px')
                            .css('font-family',"'Roboto Condensed', sans-serif")
                            .css('padding-left','50px');
                            
      var chartDiv = $("<div></div>").attr("id", this.id+"__chart"+i)
                                      .addClass("span10");
      chartView.append(chartHeader);
      chartView.append(chartDiv);
      area.append(chartView);
      chart._underlayCB = function(subgraph, i){
        return function(canvas, area, g){
          canvas.fillStyle = "hsla(0, 0% , 0%, 0.6)";
          x = g.toDomXCoord(subgraph.indexes[i]);
          canvas.fillRect(x-area.w/100, 0, area.w/50, area.h); 
        }
      }(this, i);

      chart.setXOffset(30);

      streamsContainer = {
        "actual": new DATASET.DataStream("actual"+i, "number", [1,2]),
        //"prediction": new DATASET.DataStream("preciction"+i, "number", [1,2]),
        "anomalyLabel": new DATASET.DataStream("label"+i, "category", [1,1]),
      }

      this.streams.push(streamsContainer);
      chart.addStream(streamsContainer['actual']);
      //chart.addStream(streamsContainer['prediction']);
      chart.addStream(streamsContainer['anomalyLabel']);
      chart.render(chartDiv.attr("id"));
      chart.setWidth(300);
      chart.setHeight(150);
      this.graphs.push(chart);
  }
}

SubGraphs.prototype.chartCB = function(index){
  console.log("Clicked on graph: " + index);
  var index = $("#index_"+index).html();
  console.log("   Index: " + index);
  
  /*
  TODO: Set hte hinton state
  
  $.post('getDataAtTime', {type:'details', timestep:index}, $.proxy(function(data){
    $("#auxText").html(data.auxText)
    mainHinton.dataFunction(data);
    this.selectedTimestep = pos;
  }, this),'json')
  */
}

SubGraphs.prototype.setData = function(data){
  for(i in data){
    this.setGraph(i, data[i]);
  }

  for(var i = data.length; i < this.num_graphs; ++i){
    $("#subchart_view_"+i).hide();
  }
}

SubGraphs.prototype.setGraph = function(i, data, xoffset){
  if(!xoffset){
    xoffset = 0;
  }
  $("#subchart_view_"+i).show();
  this.indexes[i] = data['index'];
  $("#index_"+i).html(data['index'])
  $("#dist_"+i).html(data['dist'])
  this.streams[i]['actual'].setData(data['actual']);
  //this.streams[i]['prediction'].setData(data['prediction']);
  this.streams[i]['anomalyLabel'].setData(data['anomalyLabel']);
  this.graphs[i].setXOffset(data['ids'][0]);
  this.graphs[i].render(this.id+"__chart"+i);
}