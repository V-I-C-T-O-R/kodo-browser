angular.module('web')
  .controller('renameModalCtrl', ['$scope', '$uibModalInstance', '$translate', '$uibModal', 'item', 'isCopy', 'currentInfo', 'moveTo', 'callback', 's3Client', 'Dialog', 'Toast', 'AuditLog',
    function ($scope, $modalInstance, $translate, $modal, item, isCopy, currentInfo, moveTo, callback, s3Client, Dialog, Toast, AuditLog) {
      var T = $translate.instant;
      //console.log(item)
      angular.extend($scope, {
        currentInfo: currentInfo,
        moveTo: moveTo,
        item: item,
        isCopy: isCopy,
        keep: {
          name: item.name
        },
        cancel: cancel,
        onSubmit: onSubmit,
        reg: {
          folderName: /^[^\/]+$/
        },
        isLoading: false,
        error_message: null
      });

      function cancel() {
        $modalInstance.dismiss('close');
      }

      function onSubmit(form) {
        if (!form.$valid) return;

        var title = T('whetherCover.title'); //是否覆盖
        var msg1 = T('whetherCover.message1'); //已经有同名目录，是否覆盖?
        var msg2 = T('whetherCover.message2'); //已经有同名文件，是否覆盖?
        //console.log(title, msg1,msg2)

        if ($scope.item.isFolder) {
          var newPath = moveTo.key == '' ? item.name : (moveTo.key.replace(/(\/$)/, '') + '/' + item.name);
          newPath += '/';
          //console.log(item.path, newPath)
          if (item.path == newPath) return;

          $scope.isLoading = true;
          s3Client.checkFolderExists(moveTo.region, moveTo.bucket, newPath).then(function (has) {
            if (has) {
              Dialog.confirm(title, msg1, function (b) {
                if (b) {
                  showMoveFolder(newPath);
                } else {
                  $scope.isLoading = false;
                }
              });
            } else {
              showMoveFolder(newPath);
            }
          }, function (err) {
            $scope.isLoading = false;
          });
        } else {
          var newPath = moveTo.key == '' ? item.name : (moveTo.key.replace(/(\/$)/, '') + '/' + item.name);
          if (item.path == newPath) return;

          //suffix
          // if(path.extname(item.path)!=path.extname(newPath)){
          //   if(!confirm('确定要修改后缀名吗?')){
          //     return;
          //   }
          // }

          $scope.isLoading = true;

          s3Client.checkFileExists(moveTo.region, moveTo.bucket, newPath).then(function (data) {
            Dialog.confirm(title, msg2, function (b) {
              if (b) {
                renameFile(newPath);
              } else {
                $scope.isLoading = false;
              }
            });
          }, function (err) {
            renameFile(newPath);
          });
        }

      }

      function renameFile(newPath) {
        var onMsg = T('rename.on'); //正在重命名...
        var successMsg = T('rename.success'); //重命名成功

        Toast.info(onMsg);
        s3Client.moveFile(currentInfo.region, currentInfo.bucket, item.path, newPath, isCopy, item.StorageClass).then(function () {
          Toast.success(successMsg);

          AuditLog.log('moveOrCopyFile', {
            regionId: currentInfo.region,
            bucket: currentInfo.bucketName,
            from: item.path,
            to: newPath,
            type: isCopy ? 'copy' : 'move',
            storageClass: item.StorageClass
          });

          $scope.isLoading = false;
          callback();
          cancel();
        }, function (err) {
          $scope.isLoading = false;
          switch (err.stage) {
            case 'copy':
              if (err.code === 'AccessDenied') {
                Toast.error(T('permission.denied'));
              }
              break;
            case 'delete':
              if (err.code === 'AccessDenied') {
                callback();
                $scope.error_message = T('permission.denied.move.error_when_delete', { fromKey: item.path, toKey: newPath });
                Toast.error($scope.error_message);
              }
              break;
          }
        });
      }

      function showMoveFolder(newPath) {
        var successMsg = T('rename.success'); //重命名成功
        $modal.open({
          templateUrl: 'main/files/modals/move-modal.html',
          controller: 'moveModalCtrl',
          backdrop: 'static',
          resolve: {
            items: function () {
              return angular.copy([item]);
            },
            moveTo: function () {
              return angular.copy(moveTo);
            },
            renamePath: function () {
              return newPath;
            },
            isCopy: function () {
              return isCopy;
            },
            fromInfo: function () {
              return angular.copy(currentInfo);
            },
            callback: function () {
              return function () {
                Toast.success(successMsg);
                $scope.isLoading = false;
                callback();
                cancel();
              };
            }
          }
        }).result.then(angular.noop, angular.noop);
      }
    }
  ]);
