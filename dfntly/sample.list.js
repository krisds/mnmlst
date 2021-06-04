// NOTE This example is under construction.
// I want it to show how to handle more changes to more complex objects,
// not just primitives.

let requirejs = require('requirejs')
requirejs(['dfntly'], function(dfntly) {

  class List {
    constructor() {
      this.list = []
      dfntly.define(this, 'length', 0)
    }

    push(value) {
      this.list.push(dfntly.is(value))
      this.length = this.list.length
    }

    get(index) {
      return this.list[index].value()
    }

    set(index, value) {
      this.list[index].becomes(value)
    }
  }

  let numbers = new List()

  let the = {}

  dfntly.define(the, 'length', () => {
    console.log(`list has ${numbers.length} item(s)`)
  })

  dfntly.define(the, 'average', () => {
    if (numbers.length == 0) return

    let sum = 0
    for (let i = 0; i < numbers.length; i++)
      sum += numbers.get(i)

    let avg = sum / numbers.length
    console.log(`average is ${avg}`)
  })

  // TODO Be able to track an item at a specific index, even when shifting/slicing...

  setImmediate(() => {
    console.log('--------------------')
    numbers.push(1)
    numbers.push(2)

    setImmediate(() => {
      console.log('--------------------')
      numbers.push(3)
      numbers.push(4)

      setImmediate(() => {
        console.log('--------------------')
        numbers.set(1, 4)
        numbers.set(2, 3)
      })
    })
  })
})
