import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLRequestContext } from '@apollo/server';
import { config } from '../config';

/**
 * Apollo Server plugin for GraphQL-specific rate limiting
 */
export const graphqlRateLimitPlugin: ApolloServerPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation(requestContext: GraphQLRequestContext<any>) {
        // Skip if rate limiting is disabled
        if (!config.api.enableRateLimit) {
          return;
        }

        // Extract query complexity from context if available
        // This will be set by the resolvers after complexity calculation
        // For now, we'll do a basic check here
        const operation = requestContext.operation;
        if (!operation) {
          return;
        }

        // Store request context for later complexity check
        // Note: context is set in expressMiddleware, not here
        // This plugin mainly serves as a hook for future enhancements
      },

      async willSendResponse(_requestContext: GraphQLRequestContext<any>) {
        // Rate limiting is handled in the resolvers and Express middleware
        // This plugin mainly serves as a hook for future enhancements
      },
    };
  },
};

