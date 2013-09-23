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


function Hinton(id, width, height, cellRows, cellCols){
  
    this.elem = document.getElementById(id)
    
    var paper = Raphael(this.elem, width, height)    
    this.dataFunction = _dataFunction.bind(this)
    this.getColorPallette = _getColorPallette
    
    this.color = hsb(180.0/360.0, 1, .9)
    this.inactive = {fill:"none", stroke:this.color, 'stroke-width':1.9,
                    opacity:0.5}
    this.predicted = {stroke:"magenta",
                      opacity:1.0, "fill-opacity":1.0}
                      
                      
    this.truePositive = {fill:"lawngreen", stroke:"lawngreen"}
    this.falseNegative = {fill:"red", stroke:"red"}
    this.falsePositive = this.predicted
    
                      
    this.active = {fill:this.color, opacity:1.0, "fill-opacity":1.0}
                      
          
    
    //# -----------------------------------------------------------------------
    this.cells = []
    this.effects = []
    this.onCells = []
    this.predictedCells = []
    
    numCells = cellRows * cellCols
    hCellSize = width/(2*cellRows + __PADDING*cellRows + __PADDING)
    vCellSize = height/(2*cellCols + __PADDING*cellCols + __PADDING)
    
    this.cellSize = Math.min(hCellSize, vCellSize)
    
    var index = 0;
    var me = this;
    for (var i=0; i < cellCols; i++){
      for (var j=0; j < cellRows; j++, index++){
        var x =__PADDING * this.cellSize + __PADDING * this.cellSize * j + 2 * this.cellSize * j + this.cellSize
        var y = __PADDING * this.cellSize + __PADDING * this.cellSize * i + 2 * this.cellSize * i + this.cellSize
                
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
            me.effects[num][1].remove()
        })
        
        this.cells.push(circle)
        this.effects.push(null)
        
      }
    }
    
    this.elem.style.width = width
    this.elem.style.height = height
    
    //this.getColorPallette(32)
}

//# =========================================================================
function _dataFunction(data){
  for(var i in this.onCells){
    var cellIdx = this.onCells[i]
    this.cells[cellIdx].attr(this.inactive)
    this.cells[cellIdx].data("active", false)
  }
    
  for(var i in this.predictedCells){
    var cellIdx = this.predictedCells[i]
    this.cells[cellIdx].attr(this.inactive)
    this.cells[cellIdx].data("predicted", false)
  }
  
  for(var i in data.predictedCols){
    this.cells[data.predictedCols[i]].attr(this.predicted)
    this.cells[data.predictedCols[i]].data("predicted", true)
  }
  
  newOnCells = data.SPBUOut
  for(var i in newOnCells){
    var cell = this.cells[newOnCells[i]]
    cell.attr(this.active)
    cell.data("active", true)
    if(cell.data("predicted"))
      cell.attr(this.truePositive)
    else
      cell.attr(this.falseNegative)
  }

  
  
  this.onCells = newOnCells
  this.predictedCells = data.predictedCols
}

//# =========================================================================
function _getColorPallette(numColors){
  var curH = 0.0;
  var curS = 0.5;
  var curB = 0.1;
  
  
  for(var c = 0; c < numColors; c++){
    //curH = curH + (137.5/360.0) 
    //curS = curS + (137.5/360.0)
    //curB = curB + (137.5/360.0)
    //
    //if(curH > 1.0)
    //  curH -= 1.0
    //if(curS > 1.0)
    //  curS -= 1.0
    //if(curB > 1.0)
    //  curB -= 1.0
    
    var curH = 1.0 * c / (numColors/8) % 8;
    //var curS = .5;
    //if(c > numColors/2)
      curS = 1.0;
    
    this.cells[c].attr({fill:Raphael.hsb(curH, 1.0, curS),
                       opacity:1.0,
                       "fill-opacity":1.0})
  }
  
}
