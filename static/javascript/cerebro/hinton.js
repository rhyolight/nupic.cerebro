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
__PADDING = 1.0

function hsb(h, s, b)
{
   return "hsb(" + [h, s, b].join(",") + ")";
}


function Hinton(id, width, height, cellRows, cellCols, trim){

    this.elem = document.getElementById(id);


    var paper = Raphael(this.elem, width, height)
    this.color = "rgb(255, 255, 61)"
    this.predictedColor = "rgb(0, 64, 224)"
    this.inactive = {fill:"none", stroke:this.color, 'stroke-width':1.9,
                    opacity:0.2}

    //# -----------------------------------------------------------------------
    this.cells = []
    this.effects = []
    this.onCells = []
    this.predictedCells = []

    numCells = cellRows * cellCols
    hCellSize = width/(2*cellCols + __PADDING*cellCols + __PADDING)
    vCellSize = height/(2*cellRows + __PADDING*cellRows + __PADDING)

    this.cellSize = Math.min(hCellSize, vCellSize)

    var index = 0;
    var me = this;
    for (var i=0; i < cellCols; i++){
      for (var j=0; j < cellRows; j++, index++){
        var x =__PADDING * this.cellSize + __PADDING * this.cellSize * i + 2 * this.cellSize * i + this.cellSize;
        var y = __PADDING * this.cellSize + __PADDING * this.cellSize * j + 2 * this.cellSize * j + this.cellSize;

        var circle = paper.circle(x, y, this.cellSize)

        circle.attr(this.inactive);
        circle.data("index",index);


        circle.mouseover(function(){
          var g = this.glow({color: me.color});
          me.effects[this.data("index")] = [this, g];
        })

        circle.mouseout(function(){
          var num = this.data("index");
          if(me.effects[num] != null)
            me.effects[num][1].remove();
        })

        this.cells.push(circle);
        this.effects.push(null);

      }
    }

    this.elem.style.width = width;
    this.elem.style.height = height;



    if(trim){
      var xExtent =__PADDING * this.cellSize + __PADDING * this.cellSize * i + 2 * this.cellSize * i + this.cellSize;
      var yExtent = __PADDING * this.cellSize + __PADDING * this.cellSize * j + 2 * this.cellSize * j + this.cellSize;
      this.elem.style.width = xExtent;
      this.elem.style.height = yExtent;
      paper.setSize(xExtent, yExtent);
    }
}



Hinton.prototype.setData = function (data){
  for (var i = 0; i < this.onCells.length; i++)
    this.cells[this.onCells[i]].attr(this.inactive)

  for (var i = 0; i < this.predictedCells.length; i++)
    this.cells[this.predictedCells[i]].attr(this.inactive)

  newOnCells = data.activeCells
  for (var i = 0; i < newOnCells.length; i++)
    this.cells[newOnCells[i]].attr({fill:this.color, opacity:1.0, "fill-opacity":1.0})

  for (var i = 0; i < data.predictedCells.length; i++)
    this.cells[data.predictedCells[i]].attr({stroke: this.predictedColor,
                                         opacity:1.0, "fill-opacity":1.0})

  this.onCells = newOnCells
  this.predictedCells = data.predictedCells
}
