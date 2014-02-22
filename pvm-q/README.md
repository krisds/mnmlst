# A minimalist process virtual machine (PVM)

This is a highly simplified and minimalist version of a Process Virtual Machine, as you'd find them in [JBPM](http://docs.jboss.com/jbpm/pvm/article/) and [Activiti](http://www.activiti.org/components.html). It has no persistence, wait states, parallel paths, etc. (yet), but it does show what the core of such a system could look like.

This version has support for asynchronous tasks, which are being handled with the help of [Q](https://github.com/kriskowal/q).

Built for [Node.js](http://nodejs.org/). You'll also need [requirejs](http://requirejs.org/docs/node.html) and [Q](https://github.com/kriskowal/q) to run.

To run the examples you'll need to install [Restify](https://github.com/mcavage/node-restify) as well.