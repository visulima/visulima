import type { PrismaCursor } from '../types'
import isPrimitive from "../../../utils/is-primitive";

const parsePrismaCursor = (
  cursor: Record<string, string | number | boolean>
): PrismaCursor => {
  const parsed: PrismaCursor = {}

  Object.keys(cursor).forEach((key) => {
    const value = cursor[key]

    if (isPrimitive(value)) {
      parsed[key as keyof typeof cursor] = value as string | number | boolean
    }
  })

  if (Object.keys(parsed).length !== 1) {
    throw new Error(
      'cursor needs to be an object with exactly 1 property with a primitive value'
    )
  }

  return parsed
}

export default parsePrismaCursor;
