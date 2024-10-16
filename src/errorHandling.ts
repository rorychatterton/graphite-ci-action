import * as core from '@actions/core'

export function handleError(error: unknown): void {
  if (error instanceof Error) {
    core.setFailed(error.message)
  } else {
    core.setFailed('An unknown error occurred')
  }
}
