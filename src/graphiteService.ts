import * as core from '@actions/core'
import * as github from '@actions/github'
import { WorkflowConfig } from './config'
import { name, version } from '../package.json'

interface RequestBodyContext {
  kind: 'GITHUB_ACTIONS'
  repository: {
    owner: string
    name: string
  }
  pr?: number
  sha: string
  ref: string
  head_ref?: string
  run: {
    workflow: string
    job: string
    run: number
  }
}

interface RequestBodyData {
  token: string
  caller: {
    name: string
    version: string
  }
  context: RequestBodyContext
}

function createRequestBody(graphiteToken: string): RequestBodyData {
  const { repo, payload, sha, ref, runId, workflow, job } = github.context

  return {
    token: graphiteToken,
    caller: { name, version },
    context: {
      kind: 'GITHUB_ACTIONS',
      repository: {
        owner: repo.owner,
        name: repo.repo
      },
      pr: payload.pull_request?.number,
      sha,
      ref,
      head_ref: process.env.GITHUB_HEAD_REF || undefined,
      run: {
        workflow,
        job,
        run: runId
      }
    }
  }
}

async function handleNonOkResponse(
  response: Response,
  requestBody: RequestBodyData
): Promise<void> {
  switch (response.status) {
    case 401:
      core.warning('Invalid authentication. Skipping Graphite checks.')
      break
    case 402:
      core.warning(
        'Your Graphite plan does not support the CI Optimizer. Please upgrade your plan to use this feature.'
      )
      break
    case 429:
      core.warning('Rate limit exceeded. Please try again later.')
      break
    default:
      core.warning(`Request body: ${JSON.stringify(requestBody)}`)
      core.warning(`Response status: ${response.status}`)
      core.warning(
        `${github.context.repo.owner}/${github.context.repo.repo}/${github.context.payload.pull_request?.number}`
      )
      core.warning(
        'Response returned a non-200 status. Skipping Graphite checks.'
      )
  }

  try {
    const errorBody = await response.text()
    core.debug(`Error response body: ${errorBody}`)
  } catch (error) {
    core.debug('Failed to read error response body')
  }

  core.setOutput('skip', false)
}

export async function requestWorkflow(config: WorkflowConfig): Promise<void> {
  const requestBody = createRequestBody(config.graphiteToken)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      config.timeout * 1000
    )

    const result = await fetch(`${config.endpoint}/api/v1/ci/optimizer`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!result.ok) {
      await handleNonOkResponse(result, requestBody)
      return
    }

    const body = (await result.json()) as { skip: boolean; reason: string }
    core.setOutput('skip', body.skip)
    core.info(body.reason)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      core.warning(`Request timed out after ${config.timeout} seconds`)
    } else {
      core.warning(
        'Failed to make request or parse response. Skipping Graphite checks.'
      )
    }
    if (error instanceof Error) {
      core.debug(`Error details: ${error.message}`)
    }
    core.setOutput('skip', false)
  }
}
