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
graph = undefined;
$(document).ready( function() {

  var fnTextArea = "fnText";
  var paramsTextArea = "paramsText";
  var sendParamsBtn = "paramsBtn";

  var descFileUpload = "fileUpload";
  var subDescFileUpload = "subFileUpload";
  var fnDataCreateBtn = "dataButton";
  var fnSaveButton = "fnSaveButton";
  var numIterationsTxt = "numIterations";

  // Styling calls
  var myCodeMirror = CodeMirror.fromTextArea(document.getElementById(fnTextArea),
                                             {mode:  "python",
                                             lineNumbers:"true"});

  $('#' + paramsTextArea).tabby()

  // Load application state
  if(localStorage.fnText)
    myCodeMirror.setValue(localStorage.fnText)

  if (localStorage.iterations)
    $('#'+numIterationsTxt).val(localStorage.iterations)


  // Private functions
  function uploadDescriptionFiles() {
    var baseFile = $('#'+descFileUpload)[0].files[0];
    var subFile = $('#'+subDescFileUpload)[0].files[0];

    if(!baseFile)
      return;
    if(!subFile)
      subFile = null;

    Experiment.sendExperimentFile(baseFile, subFile, function(modelData){
      if(subFile){
        $('#'+descFileUpload).val(null);
        $('#'+subDescFileUpload).val(null);
      }
      displayModelParams(modelData);
    });
  }

  function displayModelParams(modelData){
    displayArea = $('#' + paramsTextArea);
    displayArea.val(modelData);
    displayArea.change();
  }

  function sendModelParams(){
    var btn = $('#' + sendParamsBtn);
    var txt = $('#' + paramsTextArea);

    txt.parent('.control-group').removeClass('error');
    txt.parent('.control-group').removeClass('success');
    btn.button("loading");

    Experiment.setModelParams(txt.val())
      .complete(function () {
        btn.button("reset");
      })
      .error(function () {
        txt.parent('.control-group').addClass('error');
        setTimeout(function  () {
          txt.parent('.control-group').removeClass('error');
        }, 3000);
      })
      .success(function () {
        txt.parent('.control-group').addClass('success');
        setTimeout(function  () {
          txt.parent('.control-group').removeClass('success');
        }, 3000);
      });
  }

  function saveFunctionText () {
    text = myCodeMirror.getValue()
    localStorage.fnText = text
    localStorage.iterations = $('#' + numIterationsTxt).val()
  }


  // Bind Actions
  $('#' + fnDataCreateBtn).click(function(){
    var numIters = parseInt( $('#numIterations').val() )
    // Validate iterations
    if ( isNaN(numIters) ){
      $("#iterDialog").dialog({
        modal: true,
        buttons: {
          Ok: function() {
            $( this ).dialog( "close" );
          }
        }
      });
    }
    else{
      var fnText = myCodeMirror.getValue();
      Experiment.createFunctionDataset(fnText, numIters, displayModelParams);
    }
  })

  $('#' + descFileUpload).change(uploadDescriptionFiles);
  $('#' + subDescFileUpload).change(uploadDescriptionFiles);

  $('#' + fnSaveButton).click(saveFunctionText)

  $("#dataSaveButton").click(function(){
    window.open("saveDataset", "_blank");
  })

  $("#descSaveButton").click(function(){
    window.open("saveDescription", "_blank");
  })

    $('#' + paramsTextArea).bind('input propertychange change resize',
      function() {
          var elem = this
          elem.style.overflow = 'hidden';
          elem.style.height = 0;
          elem.style.height = elem.scrollHeight + 'px';
    });

    $('#' + sendParamsBtn).click(sendModelParams);
    $('#' + paramsTextArea).blur(sendModelParams);


});