package org.example.proyectocliente.model;

import org.apache.poi.ss.usermodel.*;
import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

public class ExcelReader {

    public static @NotNull CharacterDTO readCharacterDTOs(File file) throws IOException {
        try {
            Workbook workbook = WorkbookFactory.create(new FileInputStream(file));
            Sheet summarySheet = workbook.getSheetAt(1);
            Sheet categorySheet = workbook.getSheetAt(4);
            FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
                CharacterDTO dto = new CharacterDTO();

                dto.setName(evaluator.evaluate(summarySheet.getRow(2).getCell(12)).getStringValue());
                dto.setCategory(evaluator.evaluate(categorySheet.getRow(10).getCell(4)).getStringValue());
                dto.setLevel(Integer.parseInt(evaluator.evaluate(summarySheet.getRow(10).getCell(5)).getStringValue()));
            return dto;
        } catch (IOException e) {
            throw new IOException("Error while reading excel", e);
        }
    }

    private static String getStringCell(Cell cell) {

        return (cell != null) ? cell.toString().trim() : null;
    }
    private static Integer getIntegerCell(Cell cell) {
        if (cell == null) return null;
        return (int) Math.round(cell.getNumericCellValue());
    }
    private static Double getDoubleCell(Cell cell) {
        if (cell == null) return null;
        return cell.getNumericCellValue();
    }
}

