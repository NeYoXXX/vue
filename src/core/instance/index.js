import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
// 这5个函数的作用就是向Vue的原型中挂载方法
initMixin(Vue)
// 在Vue中挂载数据相关的实例方法（vm.$watch、vm.$set、vm.$delete）
stateMixin(Vue)
// 在Vue中挂载事件相关的实例方法（vm.$on、vm.$once、vm.$off和vm.$emit）
eventsMixin(Vue)
// 在Vue中挂载声明周期相关的实例方法（vm.$forceUpdate和vm.$destroy）
lifecycleMixin(Vue)
// （vm.$nextTick）ps:vm.$mount方法则是在跨平台的代码中挂载到Vue构造函数的prototype属性上的
renderMixin(Vue)

export default Vue
