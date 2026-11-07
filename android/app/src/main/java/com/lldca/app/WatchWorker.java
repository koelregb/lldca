package com.lldca.app;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** 后台定时检查：由 WorkManager 调度，App 关掉也会跑。 */
public class WatchWorker extends Worker {

    public WatchWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            WatchCore.run(getApplicationContext());
        } catch (Throwable ignored) {
            // 网络异常等：不重试，等下一个周期，避免叠加风暴
        }
        return Result.success();
    }
}
