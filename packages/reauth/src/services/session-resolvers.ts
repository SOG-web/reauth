import type { SessionResolvers, SubjectResolver } from '../types';

export class InMemorySessionResolvers implements SessionResolvers {
  private resolvers = new Map<string, SubjectResolver>();

  register(subjectType: string, resolver: SubjectResolver): void {
    this.resolvers.set(subjectType, resolver);
  }

  get(subjectType: string): SubjectResolver | undefined {
    return this.resolvers.get(subjectType);
  }
}
