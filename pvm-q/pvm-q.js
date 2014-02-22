// # A Minimalist Process Virtual Machine
//
// This version has support for asynchronous tasks. For that we do make use of
// an extra library: [Q](https://github.com/kriskowal/q). What exactly we use
// it for is something we'll see further on.
define(['q'], function (Q) {

  // ## Defining Processes
  //
  // A minimal process definition consists of a collection of tasks and
  // transitions between these tasks. Tasks can have behaviour assigned to
  // them, and transitions can be conditional.
  //
  // Let's start with the collection structure. We'll define it as being named
  // (being somewhat forward-looking to a time of persisted processes), and
  // holding a collection of tasks --themselves also indexed by name.
  function ProcessDefinition(id) {
    this.id = id || ''
    this.tasks = {}
  }

  // A task too is a named entity, with some optional behaviour and a list of
  // outgoing transitions.
  function Task(id, fn) {
    this.id = id
    this.fn = fn || NOP
    this.transitions = []
  }

  // Tasks should be created by asking the process definition for a named task.
  // If a task with that name already exists in the process definition it gets
  // returned (so you can use this as a getter). If not we'll create a new one
  // and add it to the collection of tasks, indexing it by its name.
  ProcessDefinition.prototype.task = function(id, fn) {
    if (this.tasks[id]) return this.tasks[id]

    var task = new Task(id, fn)
    this.tasks[id] = task
    return task
  }

  // Tasks are related through each other through transitions. Transitions are
  // modeled as functions which return the name of the next task. This way we
  // have an easy way to support conditional transitions (just use conditionals
  // to return the right task).
  //
  // The transition function may choose not to return a name. If so we'll check
  // the next transition function, and so on untill we either get a name or we
  // run out of transitions. If there is no transition which matches the process
  // will end.
  //
  // For convenience the client may also choose to pass the name of the next
  // task directly. Internally we'll wrap this in a constant function so that we
  // can streamline the logic further down.
  Task.prototype.transition = function(id_or_fn) {
    if (typeof id_or_fn == 'function')
      this.transitions.push(id_or_fn)
    else
      this.transitions.push(CONST(id_or_fn))

    return this
  }

  // ## Running processes
  //
  // One process definition may get executed multiple times, even in parallel.
  // The runtime state of a running process definition gets modeled in a
  // process. A running process keeps a link to its process definition, and to
  // the current task being executed. It also collects state which is shared by
  // all tasks in the process.
  //
  // The caller may specify the initial state of the process explicitly. This
  // allows bringing in parameters from the outside.
  //
  // There is a convention here that the initial task to execute is named
  // 'start'. But this can be overridden by specifying the start state as an
  // argument. This also allows us to model process which can have many
  // different starting points.
  function Process(process_definition, initial_state, initial_task) {
    this.process = process_definition
    this.state = initial_state || {}
    this.task = process_definition.tasks[initial_task || 'start']
  }

  // So now we come down to the overall execution logic. The engine needs to
  // know about all active processes. We will track them in a list from which
  // they will get run by the main loop.
  var processes = []

  // We're setting this process engine up to be run in a Node.js environment,
  // and we want to play nice with its asynchronous processing support.
  //
  // One way of doing so is to register a function to get called on the "next
  // tick". This option, however, has the disadvantage of running the method 
  // before doing any IO. If we're doing lots of workflow steps this will have 
  // the effect of starving the IO...
  //
  // The alternative is to make use of 'setImmediate'. Despite its name this
  // will trigger the function only after all other tick handlers and IO. While
  // that means the workflow engine itself won't run as fast as it could, it
  // does give other processes, possibly triggered by tasks, a chance of
  // running.
  //
  // So that's what the following function does. On each run it steps a single
  // process. Then, if there is more work left to be done, it reschedules
  // itself through 'setImmediate'.
  //
  // Now, the fact that tasks may be asynchronous does add some complications.
  // We can't really be sure whether or not a task is done right after
  // triggering its execution. That's where [Q](https://github.com/kriskowal/q)
  // comes into the picture. Q allows us to compose an asynchronous task with
  // the above recursion. As we'll see now...
  function tick() {
	if (processes.length == 0) return
	
    // We fetch the first process and task from the queue.
    var p = processes.shift()
    var task = p.task

    // Every step starts by executing the current task. Executing a task boils
    // down to invoking the registered function. As we do so we tell it to use
    // the current process state as 'this'. This allows for some more concise
    // task logic.
    //
    // The task itself may be asynchronous. This is where we need Q. If a task
    // asynchronous we expect it to return a [promise](http://en.wikipedia.org/wiki/Futures_and_promises).
    // Q can take these promises and allows them to be composed with other
    // steps. We, of course, will be composing it with the transition logic.
    Q().then(function() {
      if (task.fn)
        return task.fn.call(p.state)
    })
    // So, once a task is done (whether synchronous, successfull or not) the
    // following function will be triggered. This is where we look for the 
    // right transition to take. As seen earlier transitions are functions 
    // which may return the name of the next state. The first name we get will
    // be used to retrieve the next state in the process definition.
    .fin(function() {
      for (var i = 0; i < task.transitions.length; i++) {
        // (Note that the transition logic will see its 'this' as being bound to
        // execution state. This will be true as well for the task logic, and can
        // make for some leaner process definitions.)
        var result = task.transitions[i].call(p.state)
        if (result != undefined && result != null) {
          p.task = p.process.tasks[result]
          
          // If the process is not done yet we'll push it back onto the queue.
          processes.push(p)
          setImmediate(tick)

          return
        }
      }

      // If no transition is found to match then we nullify the task, which
      // basically ends the process.
      p.task = null
    })

    // If there are more processes awaiting execution we schedule another run
    // of our executor.
    if (!processes.length == 0) setImmediate(tick)
  }

  // With all of the machinery in place we still need a way to start things up.
  // That is where this final function comes into play.
  //
  // When a client wants to get a process definition running he will ask the
  // process definition to activate. This creates a new process instance and
  // adds it to the list of processes. In addition, if the process engine is
  // not running (i.e. we did not shedule it yet for execution on the next
  // tick) then we get it started now (by scheduling it, of course).
  ProcessDefinition.prototype.activate = function(initial_value, initial_task) {
    if (processes.length == 0) process.nextTick(tick)
    processes.push(new Process(this, initial_value, initial_task))
  }

  // And that's all there's to it!


  // ## Supporting functions
  //
  // These are some utility definitions which help simplify the main code.

  // This is how to do nothing. We're using this in empty tasks.
  function NOP(){}

  // This creates a function which always returns the given value. We're using
  // this as a convenience function when setting up unconditional transitions
  // between tasks.
  function CONST(val){ return function() { return val }}


  // ## Public API
  //
  // The only thing we're exposing to clients is the ProcessDefinition
  // constructor. From there the clients can define processes and activate
  // them.
  return {
    ProcessDefinition: ProcessDefinition
  }
})

