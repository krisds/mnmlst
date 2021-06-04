// # Example - Hello World
//
// This is a very simple example which prints some greetings.

let requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  // We need a context to place our data in. We could use `this`, of course,
  // but as we're not in an object and as we don't want to pollute the global
  // namespace we'll create an empty object for ths purpose instead:
  const the = { }

  // Now we create a node holding a name in that context.
  dfntly.define(the, 'name', 'world')

  // Then we create a node which generates the greeting. Note that it references
  // the previous node in its calculation. That is enough for a link to get
  // established between this node and the `name` node.
  dfntly.define(the, 'greeting', () => 'Hello ' + the.name + '.')

  // The following node will log the greeting on the console. This will not
  // happen immediately, as the dataflow engine will have to wait its turn to be
  // run by the platform. Which is why you won't see a "Hello world." message.
  dfntly.define(the, 'printing', () => {
    console.log(the.greeting)
  })

  // The following statements update the name twice. Once to "Once-ler", then
  // to "Lorax". These changes will cause the dataflow engine to be scheduled to
  // update all other nodes. However, due to the way the engine gets scheduled
  // within javascript's processing loop the recalculation will only happen
  // after all statements in this block have executed. This means that the
  // "greeting" and "print_it" nodes will only get recalculated once each, and
  // so we will only see one message on the console: "Hello Lorax."
  the.name = 'Once-ler'
  the.name = 'Lorax'

  // To get another message printed we need to schedule the update of the name.
  // We'll use `setImmediate` for that. The dataflow engine should already be
  // scheduled in the same way, and take precedence. Once it has completed this
  // will update the name, which will reschedule the engine and do another
  // round of calculations.
  setImmediate(() => { the.name = 'Dr. Seuss' })
})
