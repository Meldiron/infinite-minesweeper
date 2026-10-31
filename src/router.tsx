import { createRouter } from '@tanstack/react-router'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { ErrorComponent } from './components/error-component'

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  return createRouter({
    routeTree,
    context: { ...rqContext },
    defaultPreload: 'intent',
    defaultErrorComponent: ({ error, info, reset }) => (
      <ErrorComponent
        error={error instanceof Error ? error : new Error(String(error))}
        info={info}
        reset={reset}
      />
    ),
    Wrap: (props: { children: React.ReactNode }) => {
      return (
        <TanstackQuery.Provider {...rqContext}>
          {props.children}
        </TanstackQuery.Provider>
      )
    },
  })
}
