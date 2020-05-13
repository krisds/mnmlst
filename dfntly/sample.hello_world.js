// # Example - Hello World
//
// This is a very simple example which prints some greetings.

let requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // This creates a node holding a name.
  let name = dfntly.is('world')
  
  // This creates a node which generates the greeting. Note that it references
  // the previous node in its calculation. That is enough for a link to get
  // established between both nodes.
  let greeting = dfntly.is(() => 'Hello ' + name.value() + '.')

  // This node will log the greeting on the console. This will not happen
  // immediately, as the dataflow engine will have to wait its turn to be run
  // by the platform. Which is why you won't see a "Hello world." message.
  let print_it = dfntly.is(() => {
    console.log(greeting.value())
  })

  // The following statements update the name twice. Once to "Once-ler", then
  // to "Lorax". These changes will cause the dataflow engine to trigger and to
  // update all other nodes. However, due to the way the engine gets scheduled,
  // the recalculation will only trigger after both statements have executed.
  // This means that the "greeting" and "print_it" nodes will only get
  // recalculated once each, and so we will only see one message on the
  // console. Namely "Hello Lorax."
  name.becomes('Once-ler')
  name.becomes('Lorax')
  
  // To get another message printed we need to schedule the update of the name.
  // We'll use `setImmediate` for that. The dataflow engine should already be
  // scheduled in the same way, and take precedence. Once it has completed this
  // will update the name, which will reschedule the engine and do another
  // round of calculations.
  setImmediate(() => { name.becomes("Dr. Seuss") })
})
