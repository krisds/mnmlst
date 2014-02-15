// # Example - Hello World
//
// Based on [Joram Barrez's Hello World example](http://www.jorambarrez.be/blog/2010/08/02/tutorial-a-bpmn-2-0-hello-world-with-activiti-5-0-alpha4-in-5-steps/),
// this is probably the simplest process definition anyone can set up.

var requirejs = require('requirejs')
requirejs(['pvm'], function(pvm){

  var hello_world = new pvm.ProcessDefinition()

  // There is only a single task, and it prints out that well known message.
  hello_world.task('start', function() {
    console.log('Hello world')
  })

  hello_world.activate()
})


