import { Cluster } from './lib/db';
import { createHandler } from './lib/handlerFactory';

export default createHandler(Cluster);
