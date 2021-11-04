/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

function add (event, fn) {
  target.$on(event, fn)
}

function remove (event, fn) {
  target.$off(event, fn)
}

function createOnceHandler (event, fn) {
  const _target = target
  return function onceHandler () {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
  target = undefined
}

// 挂载vm.$on、vm.$once、vm.$off和vm.$emit 事件相关方法
export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/

 
  /*
  监听当前实例上的自定义事件，事件可以由vm.$emit触发。回调函数会接收所有传入事件所触发的函数的额外参数。
  用法示例：
  vm.$on('test', function (msg) {
     console.log(msg)
   })
   vm.$emit('test', 'hi')
   // => "hi"
  */
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 数组处理方式
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        // 使用字符串方式
        vm.$on(event[i], fn)
      }
    } else {
      // 字符串处理方式
      /*
        vm._events对象用来存储事件，如果不存在则初始化创建一个新列表，然后再添加回调函数，收集事件回调函数fn，（将回调注册到事件列表中）
        在执行new Vue()时，Vue会执行this._init方法进行一系列初始化操作，其中就会在Vue.js的实例上创建一个 _events属性，用来存储事件
        event是事件，[]是监听器列表，一对多的关系。
      */
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /*
    vm.$once(event,callback)
    用法：监听一个自定义事件，但是只触发一次，在第一次触发之后移除监听器
  */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // 当自定义事件被触发时，会执行此函数
    function on () {
      // 从vm._event中移除自身
      vm.$off(event, on)
      // 执行回调
      fn.apply(vm, arguments)
    }
    /*
    在移除监听器时，需要将用户提供的监听器函数与列表中的监听器函数进行对比，
    相同部分会被移除，这导致当我们使用拦截器代替监听器注入到事件列表中时，
    拦截器和用户提供的函数是不相同的，此时用户使用vm.$off来移除事件监听器，移除操作会失效。
    这个问题的解决方案是将用户提供的原始监听器保存到拦截器的fn属性中，当vm.$off方法遍历事件监听器列表时，
    同时会检查监听器和监听器的fn属性是否与用户提供的监听器函数相同，
    只要有一个相同，就说明需要被移除的监听器被找到了，将被找到的拦截器从事件监听器列表中移除即可。
    （此处代码与$off函数的cb.fn === fn部分相关联）
    */
    on.fn = fn
    // 使用vm.$on注册事件
    vm.$on(event, on)
    return vm
  }

  /*
    用法：移除自定义事件监听器。
    ● 如果没有提供参数，则移除所有的事件监听器。
    ● 如果只提供了事件，则移除该事件所有的监听器。（事件与监听器是一对多的关系）
    ● 如果同时提供了事件与回调，则只移除这个回调的监听器。
    使用实例：vm.$off([event,callback])
  */
  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // all
    /*
      当参数为0时，移除所有事件，重置vm._events对象
    */
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    // 当参数为列表时，循环调用vm.$off参数为字符串即可
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event （特定事件）
    // 提供字符串参数
    const cbs = vm._events[event]
    // 无此事件操作
    if (!cbs) {
      return vm
    }
    // 有此事件无回调操作
    if (!fn) {
      // 该事件为null
      // 问题：为什么再此处没有直接删除此key？保留为nullkey值还在，事件多时内存会不会有影响？null自动回收？
      vm._events[event] = null
      return vm
    }
    // specific handler
    // 如果同时提供了事件与回调，那么只移除这个回调的监听器
    let cb
    // 监听器列表长度
    let i = cbs.length
    // 在代码中遍历列表是从后向前循环，这样在列表中移除当前位置的监听器时，不会影响列表中未遍历到的监听器的位置
    while (i--) {
      cb = cbs[i]
      // 列表中的某一项与fn相同，或者某一项的fn属性与fn相同（与$once的on.fn = fn相关联，并附有解释）
      if (cb === fn || cb.fn === fn) {
        // 删除此监听器
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  /*
    vm.$emit( event, [...args] )
    用法：触发当前实例上的事件。附加参数都会传给监听器回调。
  */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }
    // 根绝event key 获取监听器列表（回调函数列表）
    let cbs = vm._events[event]
    if (cbs) {
      // toArray的作用是将类似于数组的数据转换成真正的数组
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        // 调用$on已注册的回调函数
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
