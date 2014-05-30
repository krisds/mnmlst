// # Example - That Coffee Shop
//
// The following example is a bit of a contrived simulation of a typical coffee
// shop. The inspiration for that came from an article by Gregor Hohpe entitled
// ["Your Coffee Shop Doesn’t Use Two-Phase Commit"] (http://www.eaipatterns.com/docs/IEEE_Software_Design_2PC.pdf),
// which is a great but otherwise unrelated read.
//
// This example features different states of the simulation, for which we will
// be using different combinations of systems. It also features entities whose 
// definition will get updated depending on their progress in the simulation.

var requirejs = require('requirejs')
requirejs(['ecs'], function(ecs) {

  // What the simulation will be modelling is the interaction between
  // customers, the cashier and the baristas. All of these will be entities.

  // Let's start by defining some components for our entities. We'll give all
  // entities a name; which will come in handy for displaying on the console.
  function Named(name) { this.name = name }

  // And here is a list of random first names, courtesy of [listofrandomnames.com](http://listofrandomnames.com/).
  var names = [
    'Adrienne', 'Cassidy', 'Bessie', 'Gertude', 'Tamesha', 'Bernadette',
    'Regenia', 'Sanjuanita', 'Noe', 'Lacie', 'Vilma', 'Hae', 'Saturnina',
    'Kym', 'Brady', 'Zane', 'Jeanene', 'Miss', 'Meta', 'Arlena', 'Jamal',
    'Christina', 'Alphonso', 'Nelly', 'Josh', 'Suzanne', 'Tova', 'Herbert',
    'Alonzo', 'Hoa'
  ]

  // The cashiers will have a component counting the number of customers they
  // have sold coffee to.
  function Selling() { this.customers_served = 0 }

  // Similarly, the baristas will have a component counting the number of
  // customers they have served.
  function Serving() { this.customers_served = 0 }

  // The customers themselves can have two states. They can either be queueing,
  // in which case we track their position in the queue. Or they can be waiting
  // on their order.
  function InQueue(position) { this.position = position }
  function WaitingOnOrder() { }

  // Now for the simulation states. We're going to try to model a typical day
  // in a coffee shop. We'll start by opening the shop, then we'll go into full
  // service mode and, at the end of the day, we'll close the shop again. What
  // each state does should be pretty clear from the systems it composes.
  var opening = ecs.systematic(customers_enter)
  var in_service = ecs.systematic(
	customers_enter, manage_workforce, make_sales, serve_orders)
  var closing = ecs.systematic(
	close_register, manage_workforce, serve_orders)

  // Then we get to the different systems. Each encapsulates one piece of
  // logic, which get composed in the above simulation states.
  //
  // The first system is for the entering of customers into the shop. Up to
  // three customers may enter at any time. Each customer gets assigned his or
  // her position in the queue.
  function customers_enter(time) {
	// The number of customers already in the queue:
	var customers_in_queue = ecs.count([InQueue])

	// The number of customers which enters at this time:
	var count = Math.floor(Math.random() * 3)

    // And here are the new customers.	
	for (var i = 0; i < count; i++) {
	  var name = names.shift()
	
      console.log(
	    name + ' enters the shop at '
	    + time.getHours() + ':' + time.getMinutes() + '.'
	  )

	  new ecs.Entity()
      .add(new Named(name))
      .add(new InQueue(customers_in_queue + i))

      // We recycle the name again, for a possible future use.
	  names.push(name)
    }
  }

  // The following moves workers cashiers to baristas, and back, as needed to
  // help serve the customers. All of this logic is pretty much ad hoc. Feel
  // free to make up your own.
  function manage_workforce(time) {
	console.log('It is now ' + time.getHours() + ':' + time.getMinutes() + '.')
	
	var in_queue = ecs.count([InQueue])
	var waiting_on_order = ecs.count([WaitingOnOrder])

	console.log(
	  'There is/are ' + in_queue + ' customer(s) queueing to order.')
	console.log(
	  'There is/are ' + waiting_on_order + ' customer(s) waiting on their order.')

    var cashiers_to_baristas = 0	
	if (in_queue > 0 && cashiers.length == 0)
	  cashiers_to_baristas = -1
	else if (waiting_on_order > 0 && baristas.length == 0)
	  cashiers_to_baristas = 1
	else if (in_queue/cashiers.length - waiting_on_order/baristas.length > 2)
	  cashiers_to_baristas = -1
	else if (in_queue/cashiers.length - waiting_on_order/baristas.length < -2)
	  cashiers_to_baristas = 1
	
	if (cashiers_to_baristas > 0) {
	  var worker = cashiers.shift()
	  console.log(worker.get(Named).name + ' is switching to Barista duty.')
	  baristas.push(worker)
	
	} else if (cashiers_to_baristas < 0) {
	  var worker = baristas.shift()
	  console.log(worker.get(Named).name + ' is switching to Cashier duty.')
	  cashiers.push(worker)
	}
  }

  // Making sales then. On each update each cashier will sell to one customer.
  // All other customers move forward in the queue.
  function make_sales(time) {
	if (cashiers.length == 0) return
	
	ecs.for_each([Named, InQueue], function(entity) {
	  var queueing = entity.get(InQueue)

	  if (queueing.position < cashiers.length) {
		var cashier = cashiers[queueing.position]
		
	    console.log(
		  cashier.get(Named).name + ' is selling coffee to '
		  + entity.get(Named).name + '.')
	
	    cashier.get(Selling).customers_served += 1
		entity.remove(InQueue).add(new WaitingOnOrder())
		
	  } else
	    queueing.position -= cashiers.length
	})
  }

  // Serving coffee is randomized. Each customer has a 50/50 chance of getting
  // his or her coffee this turn.
  function serve_orders(time) {
	if (baristas.length == 0) return
	
	ecs.for_each([Named, WaitingOnOrder], function(entity) {
	  if (Math.random() >= 0.5) return
	
	  var barista = baristas[Math.floor(Math.random() * baristas.length)]
	
	  console.log(
		barista.get(Named).name  + ' is serving '
		+ entity.get(Named).name + '.')
		
	  barista.get(Serving).customers_served += 1
	  entity.remove(WaitingOnOrder)
	})
  }

  // This is the system when closing up shop. All people queueing to place an
  // order will get sent away.
  function close_register(time) {
	ecs.for_each([Named, InQueue], function(entity) {
	  var queueing = entity.get(InQueue)
      console.log('Sorry, ' + entity.get(Named).name + ', we\'re closing.')
	  entity.remove(InQueue)
	})
  }

  // All right, we have defined all systems. Time to define our staff and to
  // set everything in motion.

  // Here is the staff. We have two cashiers and one barista to start off with.
  var cashiers = [
    new ecs.Entity().add(
	  new Named('Alice')).add(new Selling()).add(new Serving()),
    new ecs.Entity().add(
	  new Named('Bob')).add(new Selling()).add(new Serving())
  ]

  var baristas = [
    new ecs.Entity().add(
	  new Named('Eve')).add(new Selling()).add(new Serving())
  ]

  // The simulation itself will progress based on a timed schedule. Here are
  // relevant timings.
  var start_time   = new Date(2014, 3, 1,  7,  0, 0)
  var opening_time = new Date(2014, 3, 1,  7, 30, 0)
  var closing_time = new Date(2014, 3, 1, 17,  0, 0)
  var end_time     = new Date(2014, 3, 1, 17, 30, 0)

  // This will hold the current time, as it progresses. It will get incremented
  // in chunks of 15 minutes.
  var current_time = new Date(start_time)

  // And here, finally, we run the simulation.

  console.log('*** Doors open. ***')
  while (current_time.getTime() < opening_time.getTime()) {
	opening(current_time)
	current_time.setMinutes(current_time.getMinutes() + 15)
  }

  console.log('*** Ready for your orders. ***')
  while (current_time.getTime() < closing_time.getTime()) {
	in_service(current_time)
	current_time.setMinutes(current_time.getMinutes() + 15)
  }

  console.log('*** Time to close up shop. ***')
  while (current_time.getTime() < end_time.getTime()
         || ecs.count([WaitingOnOrder]) > 0) {
	closing(current_time)
	current_time.setMinutes(current_time.getMinutes() + 15)
  }

  // At the end of the simulation we'll print out statistics on our staff.

  console.log('Let\'s see how our staff did.')
  var coffees_sold = 0
  var coffees_served = 0

  cashiers.concat(baristas).forEach(function(barista) {
	var sold = barista.get(Selling).customers_served
	var served = barista.get(Serving).customers_served
	
    console.log(barista.get(Named).name + ':')
    console.log(' - sold ' + sold + ' coffee(s).')
    console.log(' - served ' + served + ' customer(s).')

	coffees_sold += sold
	coffees_served += served
  })

  console.log(
	'So that\'s a total of ' + coffees_sold + ' coffees sold,'
 	+ ' and ' + coffees_served + ' coffees served.')

  // And that's it. Sorry about the silly example. It was just intended to show
  // of how you could make use of an Entity/Component System. I'm always open
  // to suggestions for more interesting examples; especially if they actually
  // show a useful result.
})