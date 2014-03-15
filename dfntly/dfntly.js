// # A Minimalist Dataflow Engine
//

define([], function () {

  // ## Nodes in the Dataflow Graph
  // 
  // A dataflow graph consists of edges and nodes. The nodes are where we keep
  // hold of the state of a dataflow variable.
  function Node(value_or_fn) {
    // A node mainly consists of two things: the current value of the node, and
    // an optional function for calculating the state. It will be up to the
    // engine to trigger this function as needed.
    this.value = null
    this.fn  = null

    // We check the main argument to see whether or not it is a function, and
    // set the node's state accordingly. If it is a function we calculate its
    // result immediately.
    if (typeof value_or_fn === 'function') {
      this.fn = value_or_fn
      this.recalculate()

    } else 
      this.value = value_or_fn
  }

  // Recalculation of a node means evaulating its associated function, and
  // using the result of this evaluation as the new value. In addition to that,
  // though, we also say whether or not the value actually changed. This
  // information will be critical to the dataflow engine to decide whether or
  // not other nodes in the graph will need to be recalculated as well.
  Node.prototype.recalculate = function() {
    var new_value = this.fn()
    var value_changed = (new_value != this.value)
    if (value_changed) this.value = new_value
    return value_changed
  }

  
  // ## Edges in the Dataflow Graph
  //
  // There wouldn't be much dataflow if all nodes lived in isolation. Instead
  // we want to add links between nodes which depend on each other. 
  //
  // As an example, say that node F has a function to calculate its value, and
  // that this function depends on the value of another node X. Then there
  // should be a link between node F and node X.
  //
  // Now, we don't want the client to have to define all links between nodes.
  // That would be tedious and error-prone. Instead when a node gets
  // recalculated we'll track all nodes which are being read and add the links
  // automatically. To make that work we'll need to know which node is being
  // recalculated. This is the "active node":
  var active_node = null

  // Then we need to react to the recalculation, which means extending the
  // existing function somehow. Lacking real support for such an operation on
  // the language level we'll need to get creative...

  // So first we add an extra name which points to the existing function.
  Node.prototype.basic_recalculate = Node.prototype.recalculate

  // Then we redefine the old name. The new function adds the logic to set
  // the active node to this node, and to restore it afterwards. Of course we
  // also have to honour the existing contract of the function, which means
  // returning whether or not the node's value actually changed.
  Node.prototype.recalculate = function() {
    active_node = this  
    var value_changed = this.basic_recalculate()
    active_node = null
    return value_changed
  }

  // While we now now which node is being recalculated, we still need to know
  // which other nodes are being accessed. To make that possible we add a
  // getter function to nodes which will have to be used for reading a node's
  // value.
  Node.prototype.get_value = function() {
    if (active_node != null) {
      // Each node will need a list to track the nodes which depend on it;
      // which nodes are "downstream" from it. If this list does not yet exist
      // we'll add it now.
      if (typeof this.downstream_nodes === 'undefined')
        this.downstream_nodes = []

      // We'll also make sure that each downstream node appears only once in
      // this list. (If Javascript had support for Sets yet, we'd be using that
      // instead.)
      if (this.downstream_nodes.indexOf(active_node) < 0)
        this.downstream_nodes.push(active_node)
    }
    
    return this.value
  }


  // TODO As an optimization we should also remove links which are no longer
  // being used. It may be that upon recalculation some links just are not
  // needed anymore. We could remove these to prevent unnecessary recalcutions
  // later on...


  // ## The Engine
  //
  // So at this point we have a dataflow graph where the links between nodes
  // get established dynamically. But there is no automatic recalculation of
  // nodes yet when upstream nodes change. It's time to get that part going.

  // At runtime the engine needs to keep track of which nodes require
  // recalculation. For this we set up a simple queue of the pending nodes.
  var nodes_to_be_recalculated = []

  // We need to schedule nodes for recalulcation when one of their downstream
  // nodes changes. And change can come from recalculation, or from explicit
  // setting of the value from the outside.
  //
  // Let's start by adding a trigger upon recalculation. We'll use the same
  // trick we used earlier for extending the existing function.
  Node.prototype.linking_recalculate = Node.prototype.recalculate

  Node.prototype.recalculate = function() {
    var value_changed = this.linking_recalculate()
    if (value_changed) schedule_for_recalculation(this.downstream_nodes)
    return value_changed
  }

  // We'll define the schedule_for_recalculation function soon. First let's
  // handle explicit setting of values. For that we'll define a setter
  // function, which is pretty much a counterpart to our earlier getter.
  Node.prototype.set_value = function(new_value) {
    if (new_value == this.value) return
    
    this.value = new_value
    schedule_for_recalculation(this.downstream_nodes)
  }

  // The scheduling function then. It adds all nodes to the queue, but tries to
  // avoid duplicates in the queue.
  // 
  // In addition, if the queue was empty then it also requests the engine to be
  // run when possible. We're targetting this engine to be run in a Node.js
  // environment and so will make use of the "setImmediate" function for that.
  function schedule_for_recalculation(nodes) {
    // The check for 'undefined' is required. We've set up the triggers for
    // method without a check of whether there even are any downstream nodes
    // for which it should run. Rather than setting up that check many times
    // we'll just add it here.
    if (typeof nodes === 'undefined' || nodes.length == 0) return
    
    // If the queue is empty we'll assume the engine is not running. This is
    // not always true (see if you can figure out when), but it does not hurt
    // to do it this way.
    if (nodes_to_be_recalculated.length == 0) setImmediate(run_engine)
    
    // And finally, the actual queueing of the nodes.
    for (var i = 0; i < nodes.length; i++)
      if (nodes_to_be_recalculated.indexOf(nodes[i]) < 0)
        nodes_to_be_recalculated.push(nodes[i])
  }

  // Which leaves us with the engine itself. It is really simple: take the next
  // node in the queue (if any) and recalculate it. Then if there are more
  // nodes to be recalculated it reschedules itself for another run.
  function run_engine() {
    if (nodes_to_be_recalculated.length == 0) return
    
    var node = nodes_to_be_recalculated.shift()
    node.recalculate()
    
    if (nodes_to_be_recalculated.length > 0) setImmediate(run_engine)
  }

  // ## Public API
  //
  // There are a lot of moving parts to this dataflow engine, but most of it
  // will be hidden from clients. In fact, we only expose three things to them:
  // the ability to create new nodes, the ability to read the value of a node
  // and the ability to update the value as well.
  //
  // For the reading and writing of a node's value we'll actually make a node
  // look as if it is a single function. If you pass it a value then it uses
  // that as the new value for the node. If you don't pass a value then it just
  // returns the current value.
  Node.prototype.as_function = function() {
    return (function(new_value) {
      if (typeof new_value === 'undefined') return this.get_value()
      else this.set_value(new_value)
    }).bind(this)
  }

  // Which leaves us with the means of creating nodes. Again we set up a
  // function for this. It takes a value or a function as a paramater and
  // passes that to the constructor of the Node. The node is then returned
  // in its functional form, as we just defined.
  function make_node(value_or_fn) {
    return new Node(value_or_fn).as_function()
  }

  // And it's this "constructor" function which makes up the public API for our
  // dataflow engine.
  return make_node
})
