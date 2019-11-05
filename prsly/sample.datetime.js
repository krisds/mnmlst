// # Example - Datetime parsing
//
// This example applies parser combinators to define parsers for datetimes.

const assert = require('assert')
const requirejs = require('requirejs')
requirejs(['prsly'], function(_) {

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
    _.assert_that(character).is_a_valid(digit)
  })

  // Which is not true for any of these.
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function(character) {
    _.assert_that(character).is_not_a_valid(digit)
  })

  // Next, we'll define whitespace as a sequence of one or more spaces.
  var whitespace = _.sequence(c(' '), _.many(c(' '))).as(_.ignored_value)
  
  _.assert_that(' '      ).is_a_valid(whitespace)
  _.assert_that('    '   ).is_a_valid(whitespace)
  _.assert_that('       ').is_a_valid(whitespace)

  _.assert_that(''     ).is_not_a_valid(whitespace)
  _.assert_that('\t'   ).is_not_a_valid(whitespace)
  _.assert_that('  x  ').is_not_a_valid(whitespace)

  // The following generates parsers to match a given string (or 'literal') 
  // exactly. It does this by creating a parser for each character in the 
  // literal, and combining them in a sequence.
  function l(literal) {
    return _.sequence.apply(null, 
      literal.split('').map(function(character) { return c(character) })
    )
  }

  // We'll use that to define a parser which accepts all names of the months
  // and returns their ordinal value.
  var month = _.choice(
    l('January'  ).as(_.constant_value( 1)), 
    l('February' ).as(_.constant_value( 2)), 
    l('March'    ).as(_.constant_value( 3)), 
    l('April'    ).as(_.constant_value( 4)), 
    l('May'      ).as(_.constant_value( 5)), 
    l('June'     ).as(_.constant_value( 6)), 
    l('July'     ).as(_.constant_value( 7)), 
    l('August'   ).as(_.constant_value( 8)), 
    l('September').as(_.constant_value( 9)), 
    l('October'  ).as(_.constant_value(10)), 
    l('November' ).as(_.constant_value(11)), 
    l('December' ).as(_.constant_value(12))
  )

  _.assert_that('January' ).is_a_valid(month).with_value(_.equal_to(1))
  _.assert_that('June'    ).is_a_valid(month).with_value(_.equal_to(6))
  _.assert_that('Octember').is_not_a_valid(month)

  // A day is one to two digits long.
  var day = _.sequence(digit, _.optional(digit)).as(_.int_value)

  // A year is four digits.
  var year = _.sequence(digit, digit, digit, digit).as(_.int_value)

  // A date is a sequence of month, day and year, with some separators.    
  let comma = c(',').as(_.ignored_value)
  var date = _.sequence(month, whitespace, day, comma, whitespace, year).as(
    ([month, day, year]) => { return {
      day: day,
      month: month,
      year: year
    }}
  )

  _.assert_that('January 1, 2014').is_a_valid(date).with_value(d => {
    assert(d.day == 1 && d.month == 1 && d.year == 2014)
  })
  _.assert_that('August 17, 2014').is_a_valid(date).with_value(d => {
    assert(d.day == 17 && d.month == 8 && d.year == 2014)
  })
  _.assert_that('12-12-2012'     ).is_not_a_valid(date)

  // Hours, minutes and seconds consist of two digits each:
  var hour    = _.sequence(digit, digit).as(_.int_value)
  var minutes = _.sequence(digit, digit).as(_.int_value)
  var seconds = _.sequence(digit, digit).as(_.int_value)

  // Hours, minutes and seconds are separated by colons. Seconds are optional.
  let colon = c(':').as(_.ignored_value)
  var time = _.sequence(
    hour, colon, minutes, _.optional(_.sequence(colon, seconds).as(_.first_value))
  ).as(
    ([hours, minutes, seconds]) => { return {
      hours: hours,
      minutes: minutes,
      seconds: seconds
    }}
  )

  _.assert_that('12:12'   ).is_a_valid(time).with_value(t => {
    assert(t.hours == 12 && t.minutes == 12 && t.seconds == undefined)
  })
  _.assert_that('12:12:12').is_a_valid(time).with_value(t => {
    assert(t.hours == 12 && t.minutes == 12 && t.seconds == 12)
  })
  _.assert_that('12h12'   ).is_not_a_valid(time)

  // And finally we compose dates and times into the full datetime notation:
  var date_time = _.sequence(date, whitespace, time)

  // Now for the real test: let's give our parser a datetime, make sure it
  // accepts it, and display the value being returned.
  _.assert_that('August 17, 2014 12:12:12')
    .is_a_valid(date_time)
    .with_value(([d, t]) => {
      console.log('date time: ', [d, t])
      assert(d.day == 17 && d.month == 8 && d.year == 2014)
      assert(t.hours == 12 && t.minutes == 12 && t.seconds == 12)
    })
})