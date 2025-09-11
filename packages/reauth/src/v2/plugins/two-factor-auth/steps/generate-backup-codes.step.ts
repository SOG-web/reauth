import { type } from 'arktype';
import type { AuthStepV2, AuthOutput } from '../../../types.v2';
import type { TwoFactorAuthConfigV2, GenerateBackupCodesInput, GenerateBackupCodesOutput } from '../types';
import { generateRandomString, hashString } from '../utils/crypto';

export const generateBackupCodesValidation = type({
  userId: 'string',
  'regenerate?': 'boolean',
});

export const generateBackupCodesStep: AuthStepV2<
  GenerateBackupCodesInput,
  GenerateBackupCodesOutput,
  TwoFactorAuthConfigV2
> = {
  name: 'generate-backup-codes',
  description: 'Generate recovery backup codes for user',
  validationSchema: generateBackupCodesValidation,
  protocol: {
    http: {
      method: 'POST',
      codes: { su: 200, ic: 400, sn: 404 },
    },
  },
  inputs: ['userId', 'regenerate'],
  outputs: type({
    backupCodes: 'string[]',
    count: 'number',
  }),

  async run(input, ctx) {
    const { userId, regenerate = false } = input;
    const orm = await ctx.engine.getOrm();
    const config = ctx.config;

    // Check if backup codes are enabled
    if (!config.backupCodes?.enabled) {
      return {
        backupCodes: [],
        count: 0,
        success: false,
        message: 'Backup codes are not enabled',
        status: 'sn',
      } as GenerateBackupCodesOutput & AuthOutput;
    }

    try {
      // Check if user has existing backup codes
      if (!regenerate) {
        const existingCodes = await orm.findMany('two_factor_backup_codes', {
          where: (b: any) => b.and([
            b('user_id', '=', userId),
            b('used_at', 'IS', null)
          ]),
        });

        if (existingCodes.length > 0) {
          return {
            backupCodes: [],
            count: 0,
            success: false,
            message: 'Backup codes already exist. Use regenerate=true to create new ones.',
            status: 'ic',
          } as GenerateBackupCodesOutput & AuthOutput;
        }
      }

      // If regenerating, remove all existing backup codes for this user
      if (regenerate) {
        await orm.deleteMany('two_factor_backup_codes', {
          where: (b: any) => b('user_id', '=', userId),
        });
      }

      const backupConfig = config.backupCodes;
      const count = backupConfig.count || 10;
      const length = backupConfig.length || 8;
      
      // Generate new backup codes
      const backupCodes: string[] = [];

      for (let i = 0; i < count; i++) {
        const code = generateRandomString(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
        const hashedCode = await hashString(code);
        
        backupCodes.push(code);
        
        // Insert each backup code individually 
        await orm.create('two_factor_backup_codes', {
          user_id: userId,
          code_hash: hashedCode,
          created_at: new Date(),
        });
      }

      return {
        backupCodes,
        count: backupCodes.length,
        success: true,
        message: `Generated ${backupCodes.length} backup codes`,
        status: 'su',
      } as GenerateBackupCodesOutput & AuthOutput;

    } catch (error) {
      return {
        backupCodes: [],
        count: 0,
        success: false,
        message: `Failed to generate backup codes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'ic',
      } as GenerateBackupCodesOutput & AuthOutput;
    }
  },
};