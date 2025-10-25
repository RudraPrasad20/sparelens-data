import React, {
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUp, Loader2, Search, ArrowUpDown } from "lucide-react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationLink,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";

import { generateColors } from "@/lib/utils";
import {
  BarChart,
  LineChart,
  PieChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  Pie,
  Cell,
} from "recharts"; 
import { ModeToggle } from "./modeToggle";

interface UploadedFile {
  id: string;
  original_filename: string;
  upload_date: string; 
}

interface TableData {
  data: Record<string, any>[]; 
  total_count: number;
  page: number;
  page_size: number;
  columns: string[]; 
}

interface ChartApiResponse {
  chart_type: string;
  data: Record<string, any>[]; 
  x_column: string;
  y_column: string;
}

const API_BASE_URL = "http://localhost:8000"; 

const DashboardPage: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [chartData, setChartData] = useState<ChartApiResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedXColumn, setSelectedXColumn] = useState<string | null>(null);
  const [selectedYColumn, setSelectedYColumn] = useState<string | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<string>("bar");
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);
  const [chartFetchError, setChartFetchError] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const response = await axios.get<UploadedFile[]>(
        `${API_BASE_URL}/files/`
      );
      setFiles(response.data);
      if (response.data.length > 0 && !selectedFileId) {
        setSelectedFileId(response.data[0].id);
      } else if (response.data.length === 0 && selectedFileId) {
        setSelectedFileId(null);
      } else if (
        selectedFileId &&
        !response.data.some((f) => f.id === selectedFileId)
      ) {
        setSelectedFileId(
          response.data.length > 0 ? response.data[0].id : null
        );
      }
    } catch (error) {
      console.error("Error fetching files:", error);
      setDataFetchError("Failed to fetch files.");
    }
  }, [selectedFileId]);

  const fetchData = useCallback(async () => {
    if (!selectedFileId) {
      setTableData(null);
      return;
    }
    setIsLoadingTable(true);
    setDataFetchError(null);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        sort_by: sortColumn,
        sort_order: sortOrder,
        search_query: searchQuery,
      };
      const response = await axios.get<TableData>(
        `${API_BASE_URL}/data/${selectedFileId}`,
        {
          params,
        }
      );
      setTableData(response.data);

      if (response.data.columns.length > 0) {
        if (
          !selectedXColumn ||
          !response.data.columns.includes(selectedXColumn)
        ) {
          setSelectedXColumn(response.data.columns[0]);
        }
        if (
          !selectedYColumn ||
          !response.data.columns.includes(selectedYColumn)
        ) {
          const numericColumn = response.data.columns.find((col) => {
            return response.data.data
              .slice(0, 5)
              .some(
                (row) =>
                  typeof row[col] === "number" && !isNaN(row[col] as number)
              );
          });
          setSelectedYColumn(
            numericColumn ||
              response.data.columns[1] ||
              response.data.columns[0]
          );
        }
      } else {
        setSelectedXColumn(null);
        setSelectedYColumn(null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setTableData(null);
      setDataFetchError("Failed to fetch data.");
    } finally {
      setIsLoadingTable(false);
    }
  }, [
    selectedFileId,
    currentPage,
    pageSize,
    sortColumn,
    sortOrder,
    searchQuery,
    selectedXColumn,
    selectedYColumn,
  ]);

  const fetchChartData = useCallback(async () => {
    if (!selectedFileId || !selectedXColumn || !selectedYColumn) {
      setChartData(null);
      return;
    }
    setIsLoadingChart(true);
    setChartFetchError(null);
    try {
      const response = await axios.get<ChartApiResponse>(
        `${API_BASE_URL}/charts/${selectedFileId}`,
        {
          params: {
            chart_type: selectedChartType,
            x_column: selectedXColumn,
            y_column: selectedYColumn,
          },
        }
      );
      setChartData(response.data);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData(null);
      setChartFetchError(
        "Failed to fetch chart data. Check column types or backend logs."
      );
    } finally {
      setIsLoadingChart(false);
    }
  }, [selectedFileId, selectedChartType, selectedXColumn, selectedYColumn]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileUploadError("No file selected.");
      return;
    }

    setIsUploading(true);
    setFileUploadError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await axios.post(`${API_BASE_URL}/uploadfile/`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      alert(`File "${file.name}" uploaded successfully!`);
      setIsUploadDialogOpen(false);
      fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      if (axios.isAxiosError(error) && error.response) {
        setFileUploadError(
          error.response.data.detail || "Error uploading file."
        );
      } else {
        setFileUploadError("An unknown error occurred during file upload.");
      }
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleFileSelect = (fileId: string) => {
    setSelectedFileId(fileId);
    setCurrentPage(1);
    setSortColumn(null);
    setSearchQuery("");
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortOrder("asc");
    }
  };

  const totalPages = tableData
    ? Math.ceil(tableData.total_count / pageSize)
    : 0;
  const chartColors = chartData?.data
    ? generateColors(chartData.data.length)
    : [];

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sparelens Dashboard</h1>

        <div className="flex space-x-2">
          <ModeToggle />
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
            <DialogTrigger asChild>
              <Button>
                <FileUp className="mr-2 h-4 w-4" /> Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload New Data File</DialogTitle>
                <DialogDescription>
                  Upload your CSV or Excel files here. Max file size might be
                  limited by server config.
                </DialogDescription>
              </DialogHeader>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading && (
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                </div>
              )}
              {fileUploadError && (
                <p className="text-red-500 text-sm mt-2">{fileUploadError}</p>
              )}
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="mt-4"
                  disabled={isUploading}
                >
                  Close
                </Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>My Files</CardTitle>
          </CardHeader>
          <CardContent>
            {dataFetchError ? (
              <p className="text-center text-red-500">{dataFetchError}</p>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No files uploaded yet.
              </p>
            ) : (
              <ul>
                {files.map((file) => (
                  <li key={file.id} className="mb-2">
                    <Button
                      variant={
                        selectedFileId === file.id ? "secondary" : "ghost"
                      }
                      className="w-full justify-start truncate"
                      onClick={() => handleFileSelect(file.id)}
                    >
                      {file.original_filename}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
            <div className="flex items-center space-x-2 mt-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search data (backend not implemented for data column search yet)..."
                className="flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoadingTable || !selectedFileId}
              />
            </div>
          </CardHeader>
          <CardContent>
            {!selectedFileId ? (
              <p className="text-center text-muted-foreground">
                Select a file to view data.
              </p>
            ) : dataFetchError ? (
              <p className="text-center text-red-500">{dataFetchError}</p>
            ) : isLoadingTable && !tableData ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tableData?.columns.map((column) => (
                          <TableHead key={column}>
                            <Button
                              variant="ghost"
                              onClick={() => handleSort(column)}
                              className="px-0 py-0 h-auto"
                            >
                              {column}
                              {sortColumn === column && (
                                <ArrowUpDown
                                  className={`ml-2 h-3 w-3 ${
                                    sortOrder === "desc" ? "rotate-180" : ""
                                  }`}
                                />
                              )}
                            </Button>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData?.data.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {tableData.columns.map((column) => (
                            <TableCell key={column}>
                              {String(row[column] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {tableData?.data.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={tableData.columns.length}
                            className="h-24 text-center"
                          >
                            No results found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination className="mt-4 flex justify-between items-center">
                  <div>
                    Page {currentPage} of {totalPages} (Total{" "}
                    {tableData?.total_count} records)
                  </div>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        isActive={currentPage > 1}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink
                        isActive={true}
                        className="cursor-default"
                      >
                        {currentPage}
                      </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1)
                          )
                        }
                        isActive={currentPage < totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => setPageSize(Number(value))}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Page Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </Pagination>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      <Card>
        <CardHeader>
          <CardTitle>Data Visualization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="chart-type">Chart Type</Label>
              <Select
                value={selectedChartType}
                onValueChange={setSelectedChartType}
                disabled={!selectedFileId || !tableData?.columns.length}
              >
                <SelectTrigger id="chart-type">
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="x-column">X-Axis Column</Label>
              <Select
                value={selectedXColumn || ""}
                onValueChange={setSelectedXColumn}
                disabled={!selectedFileId || !tableData?.columns.length}
              >
                <SelectTrigger id="x-column">
                  <SelectValue placeholder="Select X-axis column" />
                </SelectTrigger>
                <SelectContent>
                  {tableData?.columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="y-column">Y-Axis Column</Label>
              <Select
                value={selectedYColumn || ""}
                onValueChange={setSelectedYColumn}
                disabled={!selectedFileId || !tableData?.columns.length}
              >
                <SelectTrigger id="y-column">
                  <SelectValue placeholder="Select Y-axis column" />
                </SelectTrigger>
                <SelectContent>
                  {tableData?.columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-8 h-[400px] w-full">
            {!selectedFileId ? (
              <p className="text-center text-muted-foreground">
                Select a file and columns to view a chart.
              </p>
            ) : isLoadingChart && !chartData ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : chartFetchError ? (
              <p className="text-center text-red-500">{chartFetchError}</p>
            ) : !chartData?.data || chartData.data.length === 0 ? (
              <p className="text-center text-muted-foreground">
                No chart data available for the selected columns and type.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {selectedChartType === "bar" && (
                  <BarChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={chartData.x_column}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey={chartData.y_column} fill="#8884d8" />
                  </BarChart>
                )}
                {selectedChartType === "line" && (
                  <LineChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={chartData.x_column}
                      angle={-15}
                      textAnchor="end"
                      height={60}
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={chartData.y_column}
                      stroke="#82ca9d"
                      activeDot={{ r: 8 }}
                    />
                  </LineChart>
                )}
                {selectedChartType === "pie" && (
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      dataKey={chartData.y_column}
                      nameKey={chartData.x_column}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      label
                    >
                      {chartData.data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
