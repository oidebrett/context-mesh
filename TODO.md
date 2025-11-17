# TODO List

## Known Issues

### Deletion Testing Not Working Reliably

**Status**: Needs Investigation

**Description**: 
User reported that deletion testing with Google Drive did not work as expected. The soft delete functionality is implemented correctly in the code, but deletions may not be detected when files are deleted from the source platform.

**Expected Behavior**:
1. User deletes a file from Google Drive
2. Nango's incremental sync detects the deletion
3. Webhook is sent to Context Mesh with `_nango_metadata.deleted_at` field
4. Context Mesh marks the record as `state: 'deleted'`
5. Record is removed from sitemap.xml
6. Record is removed from UnifiedBrowser (filters for `state: 'active'`)
7. Canonical URL still accessible but shows deletion warning banner

**Actual Behavior**:
Deletion may not be detected or processed correctly.

**Possible Root Causes**:
1. **Nango Sync Configuration**: The sync may not have `track_deletes: true` enabled
2. **Webhook Payload**: Nango may not be sending `_nango_metadata.deleted_at` in the webhook payload
3. **Sync Timing**: Incremental sync may not trigger immediately after deletion
4. **API Limitations**: Some providers may not support deletion detection via their APIs

**Investigation Steps**:
1. Check Nango sync configuration for `track_deletes: true`
2. Capture webhook payload when a file is deleted to verify `deleted_at` field is present
3. Check Nango logs for deletion events
4. Test with manual webhook trigger containing `deleted_at` field
5. Verify soft delete logic in `syncService.ts` is being executed
6. Check database to see if `state` field is being updated

**Code References**:
- Soft delete detection: `back-end/src/services/syncService.ts` (line ~150)
- Sitemap filtering: `back-end/src/routes/getSitemap.ts` (line ~26)
- UnifiedBrowser filtering: `front-end/src/components/UnifiedBrowser.tsx` (line ~26)
- Item page deletion banner: `back-end/src/routes/getItem.ts` (line ~50)

**Workaround**:
Manually update the database to test deletion behavior:
```sql
UPDATE "UnifiedObject" 
SET state = 'deleted' 
WHERE id = 'your-object-id';
```

Then verify:
- Object removed from sitemap.xml
- Object removed from UnifiedBrowser
- Canonical URL shows deletion banner

**Priority**: Medium (functionality is implemented, just needs verification)

## Future Enhancements

### High Priority

- [ ] **Vector Embeddings**: Add support for generating and storing vector embeddings for semantic search
- [ ] **Rate Limiting**: Implement rate limiting for API endpoints to prevent abuse
- [ ] **Caching**: Add Redis caching for frequently accessed data (sitemap, metadata)
- [ ] **Multi-Tenant Support**: Add proper tenant isolation and user management
- [ ] **Monitoring**: Add structured logging, metrics, and alerting (Prometheus, Grafana)

### Medium Priority

- [ ] **Advanced Search**: Implement full-text search with PostgreSQL's `tsvector` or Elasticsearch
- [ ] **Batch Operations**: Add bulk update/delete operations for UnifiedObjects
- [ ] **Export Functionality**: Allow exporting synced data to JSON, CSV, or other formats
- [ ] **Webhook Retry Logic**: Implement exponential backoff for failed webhook processing
- [ ] **Provider Health Checks**: Monitor connection health and alert on sync failures

### Low Priority

- [ ] **Custom Metadata Fields**: Allow users to add custom fields to UnifiedObjects
- [ ] **Scheduled Syncs**: Add cron-based scheduled syncs in addition to webhooks
- [ ] **Data Retention Policies**: Automatically archive or delete old records
- [ ] **API Documentation**: Generate OpenAPI/Swagger documentation for all endpoints
- [ ] **Integration Templates**: Pre-built templates for common integration patterns

## Code Quality Improvements

- [ ] **TypeScript Strict Mode**: Enable strict mode and fix all type errors
- [ ] **Unit Tests**: Add comprehensive unit tests for sync service and normalization logic
- [ ] **Integration Tests**: Add end-to-end tests for webhook processing and OAuth flows
- [ ] **Error Handling**: Improve error handling and add structured error responses
- [ ] **Input Validation**: Add Zod schemas for all API endpoints
- [ ] **Code Documentation**: Add JSDoc comments to all public functions
- [ ] **Performance Optimization**: Add database indexes for frequently queried fields
- [ ] **Security Audit**: Review authentication, authorization, and data access patterns

## Documentation Improvements

- [ ] **API Reference**: Complete API documentation with request/response examples
- [ ] **Architecture Diagrams**: Add detailed architecture and data flow diagrams
- [ ] **Deployment Guide**: Document production deployment (Docker, Kubernetes, etc.)
- [ ] **Troubleshooting Guide**: Expand troubleshooting section with common issues
- [ ] **Video Tutorials**: Create video walkthroughs for setup and usage
- [ ] **Provider-Specific Guides**: Add detailed guides for each supported provider

## Infrastructure

- [ ] **Docker Support**: Add Dockerfile and docker-compose.yml for easy deployment
- [ ] **CI/CD Pipeline**: Set up GitHub Actions for automated testing and deployment
- [ ] **Environment Management**: Add support for multiple environments (dev, staging, prod)
- [ ] **Database Migrations**: Improve migration strategy and add rollback support
- [ ] **Backup Strategy**: Implement automated database backups
- [ ] **Load Balancing**: Add support for horizontal scaling with load balancer

## Notes

- This TODO list should be reviewed and updated regularly
- High priority items should be addressed in the next sprint
- Medium and low priority items can be scheduled based on user feedback
- Code quality improvements should be ongoing and integrated into regular development

