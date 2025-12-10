# Changelog

All notable changes to MoeTasker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0-beta] - 2025-02-10

### 🎉 Major Release - Multi-Team Support with AI Command Awareness

This is a complete rewrite of MoeTasker with significant architectural improvements.

### ✨ Added

#### Multi-Team Architecture
- **Multi-group support**: Bot now works independently in multiple Telegram groups
- **Chat isolation**: Each group has its own team members, tasks, and configuration
- **Dynamic members**: No more hardcoded team members - add/remove via commands
- **Database-driven**: All data stored in PostgreSQL with proper multi-tenancy

#### New Member Management System
- `/addMember` - Add members dynamically (reply to message or use @username)
- `/removeMember` - Remove members from the team
- `/listMembers` - List all team members with roles
- `/memberInfo` - Show detailed member information
- `/updateMember` - Update member role, bio, or display name
- `/teamStats` - Show team statistics

#### Enhanced Task Management
- `/assign` - Assign tasks (improved with multi-group support)
- `/tasks` - List pending tasks (filtered by group)
- `/complete` - Complete tasks (with proper validation)
- `/clearTasks` - Clear all tasks (admin only)
- `/myTasks` - Show tasks assigned to you
- `/taskStats` - Show task statistics and top contributors

#### AI Command Awareness
- **Intent detection**: AI detects when users want to execute commands in natural language
- **Automatic execution**: AI can execute commands on behalf of users
- **Bilingual support**: Detects intents in both Spanish and English
- **Smart parameter extraction**: AI extracts parameters from conversation context
- Examples:
  - "Moe, agrega a Juan al equipo" → executes `/addMember`
  - "Asigna estas tareas: task1, task2" → executes `/assign`

#### Command System
- **Command Registry**: Central system to register and manage all commands
- **Dynamic help**: Help messages generated from registered commands
- **Aliases support**: Commands have multiple names (English + Spanish)
- **Parameter validation**: Automatic validation of command parameters
- **Category organization**: Commands organized by category (members, tasks, etc.)

#### New Services
- `memberService.js` - Complete CRUD for team members
- `commandRegistry.js` - Central command registration and execution
- `commandHandler.js` - Middleware for command processing
- `initDatabase.js` - Database initialization and migrations
- `groupConfigService.js` (planned) - Per-group configuration

#### Scripts and Tools
- `scripts/initSystem.js` - Complete system initialization script
- `npm run init:db` - Initialize database
- `npm run db:health` - Check database health
- `.env.example` - Complete environment variables documentation

#### Documentation
- `MIGRATION_GUIDE.md` - Complete migration guide from v1.x
- `TODO.md` - Detailed task list
- `STATUS.md` - Current project status
- `CHANGELOG.md` - This file

### 🔄 Changed

#### AI Model Migration
- **Switched from Groq to Cerebras** for faster inference
- **Model updated**: Now using `gpt-oss-120b`
- **Enhanced prompts**: AI now knows all available commands
- **Context awareness**: AI receives team description and command list

#### Database Schema
- All tables now include `chat_id` for multi-group support
- `team_members` table replaces hardcoded members
- Primary key changed to `(user_id, chat_id)` for members
- Proper indexes added for performance

#### Command Names
- All commands translated to English (with Spanish aliases)
- `/asignar` → `/assign` (alias kept)
- `/tareas` → `/tasks` (alias kept)
- `/completar` → `/complete` (alias kept)
- `/miembros` → `/listMembers` (alias kept)
- `/ayuda` → `/help` (alias kept)

#### Task Management
- Tasks now scoped to specific groups
- Members fetched from database instead of hardcoded list
- Improved task distribution algorithm
- Better error handling and validation

### 🗑️ Deprecated

#### Environment Variables
- `USER_ID_RAYDEL` - No longer needed (use `/addMember`)
- `USER_ID_CLAUDIA` - No longer needed (use `/addMember`)
- `USER_ID_GRETTEL` - No longer needed (use `/addMember`)
- `USER_ID_ERNESTO` - No longer needed (use `/addMember`)
- `USER_ID_JAVIER` - No longer needed (use `/addMember`)
- `GROQ_API_KEY` - Replaced by `CEREBRAS_API_KEY`

#### Files
- `lib/data/team-data.json` - Members now in database
- `lib/services/teamManager.js` - Use `memberService.js` instead

#### Hardcoded Data
- `REGISTERED_USER_IDS` in `telegram.js` - Now dynamic
- `FALLBACK_TEAM_MEMBERS` in `taskManager.js` - Now from database

### 🔧 Fixed

- Fixed task assignment not respecting group boundaries
- Fixed AI responses not including team context
- Fixed concurrent command processing issues
- Fixed edge cases in member management

### 🔒 Security

- Removed hardcoded user IDs from codebase
- Added proper chat isolation to prevent data leakage
- Environment variables properly documented
- API keys moved to environment variables

### 📝 Technical Details

#### Breaking Changes
- **Database migration required**: Run `npm run init:db` before starting
- **New dependencies**: Install `@cerebras/cerebras_cloud_sdk`
- **Environment variables changed**: Update `.env` file
- **API changes**: Service functions now require `chatId` parameter

#### Migration Path
1. Install new dependencies: `npm install`
2. Update environment variables (see `.env.example`)
3. Run database initialization: `npm run init:db`
4. Add team members using `/addMember` command
5. Start bot: `npm run dev`

See `MIGRATION_GUIDE.md` for detailed migration instructions.

---

## [1.x] - Legacy Versions

### Features in v1.x
- Single team support
- Hardcoded team members
- Basic task management
- Groq AI integration
- Spanish-only commands
- Single group operation

**Note**: v1.x is deprecated and no longer maintained. Please upgrade to v2.0.

---

## Roadmap

### Planned for v2.1
- [ ] Oracle/Decisions commands migration
- [ ] GitHub stats commands
- [ ] Sticker management commands
- [ ] Group configuration system
- [ ] Permission system (admin verification)
- [ ] Automated testing suite

### Future Features
- [ ] Web dashboard for team management
- [ ] Analytics and insights
- [ ] Integration with external tools (Jira, Trello)
- [ ] Custom commands per group
- [ ] Plugin system
- [ ] Multi-language support (beyond ES/EN)
- [ ] Scheduled notifications
- [ ] Backup and restore functionality

---

## Contributing

Contributions are welcome! Please:
1. Check `TODO.md` for pending tasks
2. Follow the existing code style
3. Add tests for new features
4. Update documentation
5. Submit a pull request

---

## Support

For issues or questions:
- Check `STATUS.md` for current status
- Review `MIGRATION_GUIDE.md` for migration help
- Check logs for error messages
- Verify environment variables

---

**Legend**:
- ✨ Added: New features
- 🔄 Changed: Changes in existing functionality
- 🗑️ Deprecated: Soon-to-be removed features
- 🔧 Fixed: Bug fixes
- 🔒 Security: Security improvements

---

*Last updated: February 10, 2025*
*Version: 2.0.0-beta*
*Status: Ready for testing* 🚀