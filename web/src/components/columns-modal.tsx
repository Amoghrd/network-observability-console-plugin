import * as React from 'react';
import {
    Button,
    DataList,
    DataListControl,
    DataListItem,
    DataListItemRow,
    DataListDragButton,
    DataListCheck,
    DataListCell,
    DragDrop,
    Draggable,
    Droppable,
    Modal,
    DataListItemCells,
    Text,
    TextContent,
    TextVariants,
} from '@patternfly/react-core';
import { useTranslation } from "react-i18next";
import { Column } from './netflow-table-header';
import * as _ from 'lodash';
import "./columns-modal.css";

export const ColumnsModal: React.FC<{
    isModalOpen: boolean;
    setModalOpen: (v: boolean) => void;
    columns: Column[];
    setColumns: (v: Column[]) => void;
    id?: string,
}> = ({ id, isModalOpen, setModalOpen, columns, setColumns }) => {
    const [updatedColumns, setUpdatedColumns] = React.useState<Column[]>([]);
    const [isAllSelected, setAllSelected] = React.useState<boolean>(false);
    const { t } = useTranslation("plugin__network-observability-plugin");

    React.useEffect(() => {
        setUpdatedColumns([...columns]);
    }, [columns]);

    React.useEffect(() => {
        let allSelected = true;
        _.forEach(updatedColumns, (col: Column) => {
            if (!col.isSelected) {
                allSelected = false;
                return false
            }
        });
        setAllSelected(allSelected);
    }, [updatedColumns]);

    const onDrop = React.useCallback(
        (source, dest) => {
            if (dest) {
                const result = [...updatedColumns];
                const [removed] = result.splice(source.index, 1);
                result.splice(dest.index, 0, removed);
                setUpdatedColumns(result)
                return true;
            }
        },
        [updatedColumns, setUpdatedColumns],
    );

    const onCheck = React.useCallback(
        (checked, event) => {
            if (event?.target?.id) {
                const result = [...updatedColumns];
                const selectedColumn = result.find((col) => col.name === event.target.id);
                if (selectedColumn) {
                    selectedColumn.isSelected = !selectedColumn.isSelected;
                    setUpdatedColumns(result)
                }
            }
        },
        [updatedColumns, setUpdatedColumns],
    );

    const onReset = React.useCallback(
        () => {
            const result = _.sortBy(updatedColumns, (col: Column) => col.defaultOrder);
            _.forEach(result, (col: Column) => {
                col.isSelected = true;
            });
            setUpdatedColumns(result);
        },
        [updatedColumns, setUpdatedColumns],
    );

    const onSelectAll = React.useCallback(
        () => {
            const result = [...updatedColumns];
            _.forEach(result, (col: Column) => {
                col.isSelected = !isAllSelected;
            });
            setUpdatedColumns(result);
        },
        [updatedColumns, setUpdatedColumns, isAllSelected],
    );

    const onSave = React.useCallback(
        () => {
            setColumns(updatedColumns);
            setModalOpen(false);
        },
        [updatedColumns, setColumns, setModalOpen],
    );

    const draggableItems = (updatedColumns.map((column, i) =>
        <Draggable key={i} hasNoWrapper>
            <DataListItem
                key={"data-list-item-" + i}
                aria-labelledby={"table-column-management-item" + i}
                className="data-list-item"
                id={"data-" + i}>
                <DataListItemRow key={"data-list-item-row-" + i}>
                    <DataListControl>
                        <DataListDragButton
                            aria-label="Reorder"
                            aria-labelledby={"table-column-management-item" + i} />
                        <DataListCheck
                            aria-labelledby={"table-column-management-item-" + i}
                            checked={column.isSelected}
                            id={column.name}
                            onChange={onCheck} />
                    </DataListControl>
                    <DataListItemCells
                        dataListCells={[
                            <DataListCell key={"data-list-cell-" + i}>
                                <label htmlFor={column.name}>
                                    {column.name}
                                </label>
                            </DataListCell>
                        ]} />
                </DataListItemRow>
            </DataListItem>
        </Draggable>
    ));

    return (
        <Modal
            id={id}
            title={t('Manage columns')}
            isOpen={isModalOpen}
            className={'modal-dialog'}
            onClose={() => setModalOpen(false)}
            description={
                <TextContent>
                    <Text component={TextVariants.p}>
                        {t('Selected columns will appear in the table.')}&nbsp;
                        {t('Click and drag the items to reorder the columns in the table.')}
                    </Text>
                    <Button isInline onClick={onSelectAll} variant="link">
                        {isAllSelected ? t('Unselect all') : t('Select all')}
                    </Button>
                </TextContent>
            }
            footer={
                <div className="footer">
                    <Button key="reset" variant="link" onClick={() => onReset()}>
                        {t('Restore default columns')}
                    </Button>
                    <Button key="cancel" variant="link" onClick={() => setModalOpen(false)}>
                        {t('Cancel')}
                    </Button>
                    <Button key="confirm" variant="primary" onClick={() => onSave()}>
                        {t('Save')}
                    </Button>
                </div>
            }>
            <div className="co-m-form-row">
                <DragDrop onDrop={onDrop}>
                    <Droppable hasNoWrapper>
                        <DataList
                            aria-label="Table column management"
                            id="table-column-management"
                            isCompact>
                            {draggableItems}
                        </DataList>
                    </Droppable>
                </DragDrop>
            </div>
        </Modal>
    );
};

export default ColumnsModal;