// # Minimalist I18n Template Formatting (parlance)

const assert = require('assert')
// TODO Reference it in this way ?
define(['../prsly/prsly'], function (_) {

  // ## The message bundle

  // A class for a collection of messages.
  // Treated as a dictionary (of nested dictionaries) of messages.
  class MessageBundle {
    constructor(messages) {
      this.messages = messages
    }

    // Looking up messages in the (nested) dictionaries.
    // The key is a classic dot-separated path.
    get_message(path) {
      let message = this.messages

      for (const key of path.split('.'))
        if (key in message)
          message = message[key]
        else
          throw `Key not found: ${path}`

      return message
    }
  }

  // --------------------------------------------------------------------------
  // **Test**
  //
  {
    const parlay = new MessageBundle({
      'name': 'Parzival',
      'inventory': {
        "pebbles": 'You have one pebble.',
        "shells": 'You have no shells.',
      },
    })

    assert(parlay.get_message('name') == 'Parzival')
    assert(parlay.get_message('inventory.pebbles') == 'You have one pebble.')
    assert(parlay.get_message('inventory.shells') == 'You have no shells.')
  }
  // --------------------------------------------------------------------------

  // ## Placeholders in messages

  // TODO Have these basic things in a "library" alongside prsly ?
  function c(character) {
    return _.is(function (value) { return value == character })
  }

  function r(from, to) {
    return _.is(function (value) { return value >= from && value <= to })
  }

  // TODO not lpar/rpar, but a logical name
  const lpar = c('{').as(_.ignored_value)
  const rpar = c('}').as(_.ignored_value)
  const underscore = c('_')
  const digit = r('0', '9')
  const alpha = _.choice(r('a', 'z'), r('A', 'Z'))
  // TODO a version of c or r which accepts a string of allowed chars for use here:
  const whitespace = _.sequence(
    _.choice(c(' '), c('\t')),
    _.many(_.choice(c(' '), c('\t')))
  ).as(_.ignored_value)

  const name = _.sequence(
    _.choice(alpha, underscore),
    _.many(_.choice(alpha, digit, underscore)).as(_.joined_value)
  ).as(_.joined_value)

  _.assert_that('item').is_a_valid(name).with_value(_.equal_to('item'))
  _.assert_that('player_1').is_a_valid(name).with_value(_.equal_to('player_1'))
  _.assert_that('Parzival').is_a_valid(name).with_value(_.equal_to('Parzival'))

  // "To be defined", so we can re-define it later on.
  const placeholder = _.to_be_defined()
  placeholder.define(_.sequence(
    lpar,
    _.optional(whitespace),
    name,
    _.optional(whitespace),
    rpar
  )).as(_.first_value)

  _.assert_that('{item}').is_a_valid(placeholder).with_value(_.equal_to('item'))

  const raw_character = _.choice(
    _.sequence(
      c('\\').as(_.ignored_value),
      _.any
    ),
    _.sequence(
      _.not(lpar),
      _.any
    )
  ).as(_.first_value)

  _.assert_that('a').is_a_valid(raw_character).with_value(_.equal_to('a'))
  _.assert_that('\\a').is_a_valid(raw_character).with_value(_.equal_to('a'))
  _.assert_that('\\{').is_a_valid(raw_character).with_value(_.equal_to('{'))
  _.assert_that('{').is_not_a_valid(raw_character)

  const raw_text = _.sequence(
    raw_character,
    _.many(raw_character).as(_.joined_value)
  ).as(_.joined_value)

  _.assert_that('you have').is_a_valid(raw_text).with_value(_.equal_to('you have'))
  _.assert_that('you have \\{}').is_a_valid(raw_text).with_value(_.equal_to('you have {}'))

  const message = _.many(
    _.choice(
      raw_text,
      placeholder
    )
  )

  _.assert_that('You have {item}.').is_a_valid(message).with_value(_.equal_to(['You have ', 'item', '.']))

  // Parse messages in bundle

  const parlance = function (messages) {
    const data = {}
    for (const key of Object.keys(messages)) {
      const definition = messages[key]
      const [stream, value] = message(new _.Stream(_.from_string(definition)))

      assert(stream != _.NO_MATCH && stream.head() == null)

      // console.log(key, definition, value)
      data[key] = value
    }

    return new MessageBundle(data)
  }

  {
    const parlay = parlance({
      'inventory': 'You have {item}.'
    })

    _.equal_to(['You have ', 'item', '.'])(parlay.get_message('inventory'))
  }


  // Have parsers return generators

  // Extending strings, rather than wrapping them.
  String.prototype.generate = function(context) {
    return this
  }

  class Placeholder {
    constructor(data) {
      this.data = data
    }

    generate(context) {
      return context[this.data]
    }
  }

  class Message {
    constructor(data) {
      this.data = data
    }

    generate(context) {
      return this.data.map(d => d.generate(context)).join('')
    }
  }

  MessageBundle.prototype.generate = function (path, context) {
    return this.get_message(path).generate(context)
  }

  raw_text.as(value => value.join(''))
  placeholder.as(value => new Placeholder(value[0]))
  message.as(value => new Message(value))

  {
    const parlay = parlance({
      'inventory': 'You have {item}.'
    })

    assert(parlay.generate('inventory', { item: 'one pebble' }) == 'You have one pebble.')
  }

  // Combining text

  class Reference {
    constructor(data) {
      this.data = data
    }

    generate(context, bundle) {
      return bundle.messages[this.data].generate(context, bundle)
    }
  }

  class Lookup {
    constructor(data) {
      this.data = data
    }

    generate(context, bundle) {
      if (this.data in context)
        return context[this.data]
      else
        return ''
    }
  }

  Placeholder.prototype.generate = function (context, bundle) {
    return this.data.generate(context, bundle)
  }

  Message.prototype.generate = function (context, bundle) {
    return this.data.map(d => d.generate(context, bundle)).join('')
  }

  MessageBundle.prototype.generate = function (path, context) {
    return this.get_message(path).generate(context, this)
  }

  const reference_marker = c('@').as(_.ignored_value)
  const reference = _.to_be_defined()
  reference.define(_.sequence(
    reference_marker,
    name
  ).as(value => new Reference(value[0])))

  const lookup = _.sequence(name).as(value => new Lookup(value[0]))

  placeholder.define(_.sequence(
    lpar,
    _.optional(whitespace),
    _.choice(
      reference,
      lookup
    ),
    _.optional(whitespace),
    rpar
  )).as(value => new Placeholder(value[0]))

  {
    const parlay = parlance({
      'item': 'one pebble',
      'inventory': 'You have {@item}.'
    })

    // console.log(parlay.generate('inventory'))
    assert(parlay.generate('inventory') == 'You have one pebble.')
  }

  {
    const parlay = parlance({
      'pebbles' : '{count} pebble(s)',
      'inventory' : 'You have {@pebbles}.'
    })

    // console.log(parlay.generate('inventory'))
    assert(parlay.generate('inventory', {count: 1}) == 'You have 1 pebble(s).')
  }

  // TODO Overrides

  class Override {
    constructor(lvalue, rvalue) {
      this.lvalue = lvalue
      this.rvalue = rvalue
    }

    apply(context) {
      context[this.lvalue] = context[this.rvalue]
    }
  }

  class ReferenceWithOverrides extends Reference {
    constructor(data, overrides) {
      super(data)
      this.overrides = overrides
      console.log(overrides)
    }

    generate(context, bundle) {
      for (const override of this.overrides)
        override.apply(context)

      const text = super.generate(context, bundle)

      // TODO unapply overrides OR have linked contexts

      return text
    }
  }

  const override = _.sequence(
    name,
    _.optional(whitespace),
    c('=').as(_.ignored_value),
    _.optional(whitespace),
    name,
  ).as(value => new Override(value[0], value[1]))

  reference.define(_.sequence(
    reference_marker,
    name,

    _.many(_.sequence(
      _.optional(whitespace),
      c(',').as(_.ignored_value),
      _.optional(whitespace),
      override
    ).as(_.first_value))

  ).as(value => new ReferenceWithOverrides(value[0], value[1])))


  {
    const parlay = parlance({
      'pebbles' : '{count} pebble(s)',
      'shells' : '{count} shell(s)',
      'inventory' : 'You have {@pebbles, count=pebble_count} and {@shells, count=shell_count}.'
    })

    console.log(parlay.generate('inventory', {pebble_count: 1, shell_count: 2}))
    // TODO assert(parlay.generate('inventory', {pebble_count: 1, shell_count: 2}) == 'You have 1 pebble(s) and 2 shell(s).')
  }

  return {
  }
})
