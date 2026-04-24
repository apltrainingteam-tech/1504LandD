import { Employee } from './lib/db';
import { createHandler } from './lib/handlerFactory';

export default createHandler(Employee);
