// # A Minimalist Dataflow Engine
//
// A dataflow engine is a system which links values at runtime in such a way
// that when one is updated all values which depend on it will automatically be
// recalculated.
//
// For example, let's say that `c` is the average of two values, `a` and `b`.
// Or in JavaScript terms:
//
//     let a = 2
//     let b = 6
//     let c = (a+b)/2
//
// At this point, `c` would have a value of 4. But what happens when we update
// the value for `a` ?
//
//     a = 12
//
// Well, without anything special, nothing beyond a change of `a`'s value would
// be seen. A dataflow engine, however, would note that `c` depends on the
// value of `a`, and so should be updated as well. With a dataflow engine we
// could be sure that `c` gets recalculated to be the new average of 9.


define([], function () {

  // ## The Dataflow Graph
  //
  // In order to be able to forward changes to values which depend on those
  // changes we need to construct a dataflow graph. Each node in this graph
  // will hold a value (or a way of calculating that value). Each edge links
  // a value to other values which depend on it.
  
  class Node {
    
    // A node mainly consists of two things: the current value of the node, and
    // an optional function for calculating that value. It will be up to the
    // engine to trigger this calculation as needed.
    constructor(value_or_calculation) {
      this.current_value = null
      this.calculation = null
      
      // Each node will need a way to track the nodes which depend on it;
      // which nodes are "downstream" from it.
      this.downstream_nodes = new Set()
      
      // Upon recalculation the set of edges may change, and some existing
      // edges may no longer be needed. In order to be able to clean these up
      // we also track the nodes which were used in the calculation; the nodes
      // "upstream" from this one.
      this.upstream_nodes = new Set()
      
      // We check the argument to see whether or not it is a function, and set
      // the node's state accordingly. If it is a function we schedule this
      // node for (re-)calculation.
      if (typeof value_or_calculation === 'function') {
        this.calculation = value_or_calculation
        schedule_one_for_recalculation(this)
  
      } else 
        this.current_value = value_or_calculation
    }

    // Recalculation of a node means evaluating its calculation function, and
    // using the result as the new value. In addition to that, we will say
    // whether or not the value actually changed. This information will be
    // useful to the dataflow engine to decide whether or not the downstream
    // nodes will need to be recalculated as well.
    recalculate() {
      let new_value = this.calculation()
      let value_has_changed = new_value != this.current_value
      this.current_value = new_value
      return value_has_changed
    }

    // While a node is being recalculated it may/will need to ask other nodes
    // for their value. When this happens, if we know which node is doing the
    // recalculation, we can link that node as being downstream from this one.
    //
    // Doing it this way means the client doesn't have to encode the links
    // him/herself, making it automatic and less error-prone.
    value() {
      if (node_being_recalculated) {
        this.downstream_nodes.add(node_being_recalculated)
        node_being_recalculated.upstream_nodes.add(this)
      }
    
      return this.current_value
    }

    // A node's value may also be updated by the client. When this happens, and
    // if the value is a new value, then we will schedule all downstream nodes
    // for recalculation.
    becomes(new_value) {
      if (new_value == this.current_value) return
    
      this.current_value = new_value
      schedule_all_for_recalculation(this.downstream_nodes)
    }
  }
  

  // ## The Engine
  //
  // Let's now get to the engine driving the calculations. As a start the
  // engine needs to keep track of which nodes require recalculation. For this
  // we set up a simple queue of the pending nodes.
  let nodes_to_be_recalculated = []

  // The engine will recalculate one node at a time. While it does so, it keeps
  // track of that node so we can use it to link up the dataflow graph (as done
  // in the Node class).
  let node_being_recalculated = null
    

  // The scheduling function then. We make use of the Javascript runtime to
  // invoke our engine as soon as possible.
  function schedule_engine() {
    if (!node_being_recalculated) setImmediate(run_engine)
  }
    
  // The above gets wrapped in two utility functions which can request
  // recalculation of one or more nodes. They add any given nodes to the queue,
  // but try to avoid duplicates.
  function schedule_one_for_recalculation(node) {
    if (nodes_to_be_recalculated.indexOf(node) < 0)
      nodes_to_be_recalculated.push(node)

    schedule_engine()
  }

  function schedule_all_for_recalculation(nodes) {
    if (!nodes || nodes.size == 0) return
    
    for (let node of nodes)
      if (nodes_to_be_recalculated.indexOf(node) < 0)
        nodes_to_be_recalculated.push(node)

    schedule_engine()
  }

  // Which leaves us with the core engine loop. It is really simple: take the
  // next node in the queue (if any) and recalculate it. Keep doing that until
  // there are no more nodes left.
  function run_engine() {
    while (nodes_to_be_recalculated.length > 0) {
      node_being_recalculated = nodes_to_be_recalculated.shift()
      
      // TODO Allow a node to enable/disable this behaviour ?
      for (let node of node_being_recalculated.upstream_nodes)
        node.downstream_nodes.delete(this)
      node_being_recalculated.upstream_nodes.clear()
      
      let value_changed = node_being_recalculated.recalculate()
      
      if (value_changed)
        for (let node of node_being_recalculated.downstream_nodes)
          if (nodes_to_be_recalculated.indexOf(node) < 0)
            nodes_to_be_recalculated.push(node)
      
      node_being_recalculated = null
    }
  }

  // ## Public API
  //

  return {
    is: (value_or_fn) => new Node(value_or_fn)
  }
})
