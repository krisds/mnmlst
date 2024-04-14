# parlance

## Basic format and simple text

Text is stored in a JSON format, where you can associate a piece of text with a certain key.

```json
    { "inventory" : "You have one pebble." }
```

`parlance.generate('inventory') == 'You have one pebble.'`


## Placeholders and context

Messages may be parameterized by adding placeholders for text in parentheses.

```json
    { "inventory" : "You have {item}." }
```

Then pass in a value for that placeholder when generating the text.

```js
    parlance.generate('inventory', {item: 'one pebble'}) == 'You have one pebble.'
```

Placeholder names must be valid variable names. So any combination of letters,
digits and underscores, where the first character is not a digit.

## Combining text

One text may include another by referencing its key in a placeholder.
References start with the `@` character, followed by the key for the text you want to include.
Keys, too, must be valid variable names.

```json
    {
        "item" : "one pebble",
        "inventory" : "You have {@item}."
    }
```

```js
    parlance.generate('inventory') == 'You have one pebble.'
```

## Combining text and context

When combining text, any placeholders are looked up in the context.

```json
    {
        "pebbles" : "{count} pebble(s)",
        "inventory" : "You have {@pebbles}."
    }
```

```js
    parlance.generate('inventory', {count: 1}) == 'You have 1 pebble(s).'
```

## Overrides

When combining text, you can also override the context.

```json
    {
        "pebbles" : "{count} pebble(s)",
        "shells" : "{count} shell(s)",
        "inventory" : "You have {@pebbles, count=pebble_count} and {@shells, count=shell_count}."
    }
```

```js
    parlance.generate('inventory', {pebble_count: 1, shell_count: 2}) == 'You have 1 pebble(s) and 2 shell(s).'
```

## Values from object

When the value in a context is an object / a dictionary, you can use dot-notation to access those contained values.

```json
    {
        "pebbles" : "{count} pebble(s)",
        "shells" : "{count} shell(s)",
        "inventory" : "You have {@pebbles, count=count.pebbles} and  {@shells, count=count.shells}."
    }
```

```js
    parlance.generate('inventory', {count: {pebbles: 1, shells: 2}}) == 'You have 1 pebble(s) and 2 shell(s).'
```

## `!when`

Note: I know JSON doesn't support multiline strings, but for readability here,
let's assume it does.

When you have to vary text depending on a value, you can use the `!when` logic.

```json
    { "inventory" : "You have {!when count:
        is 0:     {no pebbles}
        is 1:     {one pebble}
        is 2:     {two pebbles}
        is other: {many pebbles}
      }."
    }
```

```js
    parlance.generate('inventory', {count: 0}) == 'You have no pebble.'
    parlance.generate('inventory', {count: 1}) == 'You have one pebble.'
    parlance.generate('inventory', {count: 2}) == 'You have two pebbles.'
    parlance.generate('inventory', {count: 3}) == 'You have many pebbles.'
```

TODO One, two, few, many


```json
    { "inventory" : "Welcome {!when name:
        is {Parzival}: {Player 1}
        is other:      {player}
      }."
    }
```


## `!each`

When you have to format a list of things, use the `!each` logic.

```json
    { "inventory" : "You have collected {!each item in items: {{item}},
        separator = {, },
        last-separator = { and }
      }."
    }
```

```js
    parlance.generate('inventory', {
        items: [ 'pebbles', 'shells', 'driftwood' ]
    }) == 'You have collected pebbles, shells and driftwood.'
```

## `!each` + `@` + `!when`

```json
    { "inventory" : "You have {!each item in items: {{@describe, item=item}},
        separator = {, },
        last-separator = { and }
      }.",
      "describe": "{!when item.type:
        is {pebble}:    {@pebble,    count=item.count}
        is {shell}:     {@shell,     count=item.count}
        is {driftwood}: {@driftwood, count=item.count}
      }",
      "pebble" : "{!when count:
        is 0:     {no pebbles}
        is 1:     {one pebble}
        is 2:     {two pebbles}
        is other: {many pebbles}
      }.",
      "shell" : "{!when count:
        is 0:     {no shells}
        is 1:     {one shell}
        is 2:     {two shells}
        is other: {many shells}
      }.",
      "driftwood" : "{!when count:
        is 0:     {no driftwood}
        is 1:     {one piece of driftwood}
        is 2:     {two pieces of dirftwood}
        is other: {driftwood}
      }."
    }
```

```js
    parlance.generate('inventory', {
        items: [
            {type: 'pebble', count: 1},
            {type: 'shell', count: 2},
            {type: 'driftwood', count: 3}
        ]
    }) == 'You have one pebble, two shells and driftwood.'
```

## Dot-notation and keys

TODO ...

## Parameterized keys

```json
    {
        "items" : {
          "pebbles": "some pebbles",  
          "shells": "several beautiful shells",  
        },
        "inventory" : "You have {@items.{item}}."
    }
```

## Post-processsing

```json
    { "inventory" : "{!each item in items: {item | capitalize}, separator={, }}."
    }
```

```js
    parlance.generate('inventory', {
        items: [ 'pebbles', 'shells', 'driftwood' ]
    }) == 'Pebbles, Shells and Driftwood.'
```
