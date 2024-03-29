import type { Message } from 'esbuild';
import { formatMessages } from 'esbuild'
import type { PluginContext } from 'rollup'

const warn = async (
  pluginContext: PluginContext,
  messages: Message[],
) => {
  if (messages.length > 0) {
    const warnings = await formatMessages(messages, {
      color: true,
      kind: 'warning',
    })
    warnings.forEach((warning) => pluginContext.warn(warning))
  }
}

export default warn
