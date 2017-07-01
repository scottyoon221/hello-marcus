import React from 'react';
import ReactDOM from 'react-dom';
import $ from 'jquery';
import Utils from './utils.js';
import client_env from './client_env.js';
import houndifyclient from './houndify-client.js';
import ResponseCard from './components/ResponseCard.jsx';

class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      response: {type: "text", api: "default", text: "What can I help you with?", data: Object},
      location: {}
    };

    const clientID = client_env.client_env.houndify_clientID;

    this.requestInfo = {
      ClientID: clientID,
      UserID: "test_user"
    };
  }

  componentDidMount() {
    Utils.location().
    then((data) => {
      this.setState({
        location: {
          lat: data.coords.latitude,
          lon: data.coords.longitude
        }
      })
    })
  }

  // trigger response state to change when getting back reply from Fred
  handleServerResponse(error, response) {
    if (error) {
      console.log('handleServerResponse error: ', error);
    } else {
      console.log('handleServerResponse: ', response);
      this.setState({
        response: response
      })
      console.log("after changing state: ", this.state.response);
      this.responseTextToSpeech(response.text);
    }
  }

  // convert text to speech using chrome built in function
  responseTextToSpeech(text) {
    let msg = new SpeechSynthesisUtterance();
    let voices = window.speechSynthesis.getVoices();
    msg.text = text;
    msg.rate = 12 / 10;
    msg.pitch = 0;
    speechSynthesis.speak(msg);
  }

  //handle voice button click
  startStopVoiceSearch() {
    var myClient = new Houndify.HoundifyClient(houndifyclient.houndifyClient(this.state.location, this.handleServerResponse.bind(this)));
    if (myClient.voiceSearch.isStreaming()) {
      console.log('window object stop', window);
      //stops streaming voice search requests, expects the final response from backend
      myClient.voiceSearch.stop();
    } else {
      myClient.voiceSearch.startRecording(this.requestInfo);

      this.audioFrequency();

      ///audio frequency stop
      //starts streaming of voice search requests to Houndify backend
      document.getElementById("voiceIcon").className = "loading circle notched icon big";
      document.getElementById("textSearchButton").disabled = true;
      document.getElementById("query").readOnly = true;
    }
  }

  audioFrequency() {

    var constraints = window.constraints = {
      audio: true,
      video: false
    };

    function handleSuccess(stream) {

      var audioTracks = stream.getAudioTracks();
      console.log('Got stream with constraints:', constraints);
      console.log('Using audio device: ' + audioTracks[0].label);
      stream.oninactive = function() {
        console.log('Stream ended');
      };
      window.stream = stream; // make variable available to browser console
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var analyser = audioCtx.createAnalyser();

      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyser.smoothingTimeConstant = 0.85;

      var distortion = audioCtx.createWaveShaper();
      var gainNode = audioCtx.createGain();
      var biquadFilter = audioCtx.createBiquadFilter();
      var convolver = audioCtx.createConvolver();




      var source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.connect(distortion); 
       source.connect(analyser);
       analyser.connect(distortion);
       distortion.connect(biquadFilter);
       biquadFilter.connect(convolver);
       convolver.connect(gainNode);
       gainNode.connect(audioCtx.destination);

      analyser.fftSize = 256;
      var bufferLength = analyser.frequencyBinCount;
      console.log(bufferLength);
      var dataArray = new Float32Array(bufferLength);

      var canvas = document.querySelector('.visualizer');
      var canvasCtx = canvas.getContext("2d");

      var intendedWidth = document.querySelector('.wrapper').clientWidth;

      canvas.setAttribute('width',intendedWidth);

      canvas.setAttribute('width', 500);

      canvasCtx.clearRect(0, 0, 200, 200);

      var drawVisual;

      function draw() {

        console.log('ran draw')

        var WIDTH = canvas.width;
        var HEIGHT = canvas.height;
        drawVisual = requestAnimationFrame(draw);

        analyser.getFloatFrequencyData(dataArray);

        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        var barWidth = (WIDTH / bufferLength) * 2.5;
        var barHeight;
        var x = 0;

        for (var i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] + 140)*2;
          
          canvasCtx.fillStyle = 'rgb(' + Math.floor(barHeight+100) + ',50,50)';
          canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);

          x += barWidth + 1;
        }
      }

      draw();



    }

    function handleError(error) {
      console.log('navigator.getUserMedia error: ', error);
    }

    navigator.mediaDevices.getUserMedia(constraints).
        then(handleSuccess).catch(handleError);




  }

  //handle user text input
  textQuery() {
    var query = document.getElementById('query').value;
    console.log(query);
    console.log(this.state.location)
    $.ajax({
      url: '/voice',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        RawTranscription: query,
        WrittenResponseLong: query,
        location: this.state.location}),
      success: (data) => {
        console.log('text query response from server: ', data.data);
        this.setState({
          response: data
        });
        this.responseTextToSpeech(data.text);
      },
      error: (err) => {
        console.log('err', err);
      }
    });
  }


  render () {
    var border = {border: 0, outline: 'none'};
    return (
      <div>
        <div className="ui centered  grid" >
      <div className ='wrapper'>
        <div className="ui center aligned basic segment container">
          <ResponseCard response={this.state.response} />
        </div>
        <div className="ui centered grid">
          <form id="form" className="ui form" action="javascript:void(0);">
            <div className="ui action big labeled fluid input field">
              <div className="ui icon basic label button" onClick= {this.startStopVoiceSearch.bind(this)} style={border}>
                <i id="voiceIcon" className="unmute huge icon"></i>
              </div>
            </div>
            <div className="ui field" hidden>
              <label>Response object</label>
              <textarea id="responseJSON"></textarea>
            </div>
            <input id="query" type="text" placeholder="Click on a microphone icon or type in your query" />
            <button id="textSearchButton" className="ui icon button" onClick= {this.textQuery.bind(this)}>
               <i className="search big icon"></i>
            </button>
          </form>
        </div>
      <canvas className="visualizer" width="640" height="100"></canvas> 

      </div>
    )
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
