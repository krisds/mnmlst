// # Example - Datetime parsing
//
// This example applies parser combinators to define parsers for datetimes.

var requirejs = require('requirejs')
requirejs(['prsly'], function(_) {

  // Our inputs will be strings, so the first thing we need is to ability for
  // streams to use them. To that end we set up a generator function which will
  // return each character of the given string in turn.
  function from_string(string) {
    var position = 0
    return function() {
      if (position < string.length) return string.charAt(position++)
      else return null
    }
  }

  // The following extends strings with a function which makes testing them
  // against a given parser easy and readable.
  String.prototype.is_a_valid = function(parser) {
    var result = parser(new _.Stream(from_string(this)))
    if (result == null || result.tail() != null)
      console.log('[FAIL] ' + this)
  }

  // And one for the negative test:
  String.prototype.is_not_a_valid = function(parser) {
    var result = parser(new _.Stream(from_string(this)))
    if (result != null && result.tail() == null)
      console.log('[FAIL] ' + this)
  }

  // But that's enough setup, let's get to the actual parsing.
  //
  // Given that we're parsing strings the basic units which we'll need to be
  // able to match are individual characters. The following function generates 
  // such single character parsers.
  function c(character) {
    return _.is(function(value) { return value == character })
  }

  // Apart from specific characters, we can also add support for recognizing 
  // a character in a given range of characters:
  function r(from, to) {
    return _.is(function(value) { return value >= from && value <= to })
  }

  // Based on that we can describe what a digit is:
  var digit = r('0', '9')

  // One extremely useful side effect of the parser combinator approach is that
  // we can easily unit test these individual building blocks. This can make
  // your parsers much more robust against changes over time.
  //
  // So each of these characters are digits:
  '0123456789'.split('').forEach(function(character) {
    character.is_a_valid(digit)
  })

  // Which is not true for any of these.
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function(character) {
    character.is_not_a_valid(digit)
  })

  // Next, we'll define whitespace as a sequence of one or more spaces.
  var whitespace = _.sequence(c(' '), _.many(c(' ')))

  ' '.is_a_valid(whitespace)
  '    '.is_a_valid(whitespace)
  '       '.is_a_valid(whitespace)
  ' '.is_a_valid(whitespace)

  ''.is_not_a_valid(whitespace)
  '\t'.is_not_a_valid(whitespace)
  '  x  '.is_not_a_valid(whitespace)

  // The following generates parsers to match a given string (or 'literal') 
  // exactly. It does this by creating a parser for each character in the 
  // literal, and combining them in a sequence.
  function l(literal) {
    return _.sequence.apply(null, 
      literal.split('').map(function(character) { return c(character) })
    )
  }

  // We'll use that to define a parser which accepts all names of the months.
  var month = _.choice(
    l('January'), 
    l('February'), 
    l('March'), 
    l('April'), 
    l('May'), 
    l('June'), 
    l('July'), 
    l('August'), 
    l('September'), 
    l('October'), 
    l('November'), 
    l('December')
  )

  'January'.is_a_valid(month)
  'June'.is_a_valid(month)
  'Octember'.is_not_a_valid(month)

  // A day is one to two digits long.
  var day = _.sequence(digit, _.optional(digit))

  // A year is four digits.
  var year = _.sequence(digit, digit, digit, digit)

  // A date is a sequence of month, day and year, with some separators.    
  var date = _.sequence(month, whitespace, day, c(','), whitespace, year)

  'January 1, 2014'.is_a_valid(date)
  'August 17, 2014'.is_a_valid(date)
  '12-12-2012'.is_not_a_valid(date)

  // Hours, minutes and seconds consist of two digits each:
  var hour = _.sequence(digit, digit)
  var minutes = _.sequence(digit, digit)
  var seconds = _.sequence(digit, digit)

  // Hours, minutes and seconds are separated by colons. Seconds are optional.
  var time = _.sequence(
    hour, c(':'), minutes, _.optional(_.sequence(c(':'), seconds))
  )

  '12:12'.is_a_valid(time)
  '12:12:12'.is_a_valid(time)
  '12h12'.is_not_a_valid(time)

  // And finally we compose dates and times into the full datetime notation:
  var date_time = _.sequence(date, whitespace, time)

  'August 17, 2014 12:12:12'.is_a_valid(date_time)
})