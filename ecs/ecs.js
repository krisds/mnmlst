// # A Minimalist Entity/Component System
//
// An Entity/Component System is an architecture for defining complex groups of
// objects with pluggable behaviour. It finds its origins in game development,
// where the more traditional object-oriented model was found wanting.
//
// As you may have guessed from the name an Entity/Component System is built on
// three basic concepts:
// 
// * Entities: these are little more than a name, or a handle, for an object.
//   In particular it has no state or behaviour of its own.
// * Components: these hold a logical unit of state. A typical example of a
//   component is "position", which could hold coordinates and orientation.
//   Entities get assigned components, which means they somehow get related.
//   Similar to entities, components have no behaviour of their own either.
// * Systems: these hold a logical unit of behaviour, which gets applied to
//   a selection of entities which are related to certain kinds of components.
//   An example of a system could be "movement", which might select all
//   entities which are assigned a position, and which could then update that
//   position.
//
// All of this makes for a very dynamic architecture. You can add and remove
// systems as needed, effectively extending the runtime behaviour. Similarly,
// you can assign or remove components to and from entities as well. Doing so
// would let them get picked up (or drop out from) specific behaviour.
//
// Well, there's a lot more to it than that, and on the web you'll find many
// more interesting examples. The [Entity Systems Wiki](http://entity-systems.wikidot.com/) 
// provides an excellent starting point.

define([], function () {
  // When implementing an Entity/Component System, the main choice we have to
  // make is how to represent and link entities and components. Because this is
  // a minimalist implementation, we're going to choose a simple option. Both
  // entities and components will be Javascript objects. The components will
  // get added to the entity objects on the fly.
  //
  // Let's get started.

  // ## Entities
  //
  // The systems will need some way to query all entities. To make that
  // possible the engine will keep track of all entities which get created.
  var entities = []

  // As we said, an entity is just an object. It has no data or behaviour.
  // All we want it to do is add itself into the list of entities.
  function Entity() {
    entities.push(this)
  }

  // ## Components
  //
  // Components, of course, do have state. That's exactly what they're about.
  // Unfortunately, we don't really know what state that is. It is up to the
  // client to define component constructors.
  // 
  // What we do need to define, however, is a way to link components to
  // entities. We do that by assigning the component to a new field in the
  // entity, the name of which is the name of the type of the component. This
  // means that the client should give all component types unique names; which
  // shouldn't be too bad of a requirement to have to deal with.
  Entity.prototype.add = function(component) {
    this[component.constructor.name.toLowerCase()] = component
    return this
  }
  // Note that we return `this`; we do so to allow the caller to chain multiple
  // of these calls in one go. After all, it is quite likely that an entity
  // will have more than one component linked to it.

  // Having added components to an entity, this allows you to retrieve one from
  // an entity.
  Entity.prototype.get = function(component_constructor) {
    return this[component_constructor.name.toLowerCase()]
  }

  // To unlink the component from the entity again, we just nullify the value.
  Entity.prototype.remove = function(component_constructor) {
    this[component_constructor.name.toLowerCase()] = null
    return this
  }

  // ## Systems
  //
  // As systems are units of behaviour, systems will be modeled as simple
  // functions. Again it is up to the client to define these; the engine itself
  // can not know what that should be.

  // ## Supporting functions
  //
  // So far this minimalist implementation has been just that: minimalist. We
  // basically said that it is up to the client to define what she wants... The
  // client, however, could use some extra supporting functions to make life on
  // her side easier. The major thing she needs to be able to do is to query
  // the engine for entities which have a certain combination of components.

  // Let's start by adding a test to entities to see if it has a specific set
  // of components. We can do this easily by looping over all components and
  // checking whether the entity has the corresponding field.
  Entity.prototype.has_all = function(component_constructors) {
	for (var i = 0; i < component_constructors.length; i++) {
	  var component = this.get(component_constructors[i])
	  if (typeof component === 'undefined' || component == null)
	    return false
	}
	
	return true
  }

  // The query itself then. We'll set this up in typical callback style. That
  // is, the query will apply the specified callback against each of the
  // matching entities. E.g. `for_each([position, sound], console.log)` would
  // write all entities to console which have a position and sound component.
  function for_each(component_constructors, fn) {
    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i]
      if (entity.has_all(component_constructors)) fn(entity)
    }
  }

  // You can think of the entities and components as a queryable database (and,
  // in fact, you could probably use database optimization techniques to make
  // the engine faster). A useful thing to do in a database is to get a count
  // of matching rows. Here we'll do something similar: returning a count of
  // matching entities.
  function count(component_constructors) {
	var c = 0
    for (var i = 0; i < entities.length; i++) {
      var entity = entities[i]
      if (entity.has_all(component_constructors)) c += 1
    }
    return c
  }

  // The above functions will make it possible for systems to select relevant
  // entities and process them as needed. What we're still missing is a nice
  // and easy way for the client to select relevant systems and call them as
  // needed. This will be our final function.
  //
  // We're going to set this up as a curried function of sorts. That is, the
  // result of this function will be another function which can then be used to
  // invoke each of the systems in the orginal order specified. In addition,
  // any arguments passed to this function will also be provided to the
  // systems.
  //
  // An example would probably make this more clear. Let's say we're working in
  // the context of a game. We could then set up the update function by doing:
  // `var update = systematic(movement, rendering)`. Then, on each game tick
  // you just invoke `update(game_tick)`. This would cause the "movement" and
  // "rendering" systems to get invoked (in that order), and each would get the
  // current "game_tick" value as an input.
  //
  // With that all said, let's get to the code.
  function systematic() {
	// This is just a varargs trick. It captures all of the argumenst to the
	// function in an array.
    var systems = Array.prototype.slice.call(arguments, 0)
    
    // This function then just iterates over this list, and invokes each of the
    // functions in turn, forwarding the arguments that it got to each.
    return function() {
      for (var i = 0; i < systems.length; i++)
        systems[i].apply(null, arguments)
    }
  }

  // ## Public API
  //

  return {
	Entity: Entity,
	for_each: for_each,
	count: count,
	systematic: systematic
  }
})
